import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WorkingHours } from '@/types'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateQuery } from '@/lib/api/validate'
import { slotsQuerySchema } from '@/lib/schemas'

const supabase = createAdminClient()

const DAY_KEYS: Record<number, keyof WorkingHours> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

function generateSlots(open: string, close: string, durationMinutes: number): string[] {
  const slots: string[] = []
  const [openH, openM] = open.split(':').map(Number)
  const [closeH, closeM] = close.split(':').map(Number)
  let current = openH * 60 + openM
  const end = closeH * 60 + closeM

  while (current + durationMinutes <= end) {
    const h = Math.floor(current / 60).toString().padStart(2, '0')
    const m = (current % 60).toString().padStart(2, '0')
    slots.push(`${h}:${m}`)
    current += durationMinutes
  }
  return slots
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

/** Slot'un mevcut randevularla çakışıp çakışmadığını doğrudan kontrol eder (30dk granülasyon yok) */
function hasConflict(
  slotStart: number,
  duration: number,
  appointments: { start_time: string; end_time: string }[]
): boolean {
  const slotEnd = slotStart + duration
  return appointments.some(apt => {
    const aptStart = toMinutes(apt.start_time)
    const aptEnd = toMinutes(apt.end_time)
    return slotStart < aptEnd && slotEnd > aptStart
  })
}

/** Slot'un bloklanmış saat dilimleriyle çakışıp çakışmadığını kontrol eder */
function isBlockedSlot(
  slotStart: number,
  duration: number,
  blocked: { start_time: string; end_time: string }[]
): boolean {
  const slotEnd = slotStart + duration
  return blocked.some(b => {
    const bStart = toMinutes(b.start_time)
    const bEnd = toMinutes(b.end_time)
    return slotStart < bEnd && slotEnd > bStart
  })
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const rl = checkRateLimit(req, RATE_LIMITS.general)
  if (rl.limited) return rl.response

  const { searchParams } = new URL(req.url)
  const qResult = validateQuery(searchParams, slotsQuerySchema)
  if (!qResult.ok) return qResult.response
  const { date, duration, staffId } = qResult.data
  const dateObj = new Date(date + 'T00:00:00')
  const dayKey = DAY_KEYS[dateObj.getDay()]

  // İşletme çalışma saatleri
  const { data: business } = await supabase
    .from('businesses')
    .select('working_hours')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const hours = (business.working_hours as WorkingHours)[dayKey]
  if (!hours) {
    return NextResponse.json({ slots: [], message: 'Bu gün kapalı' })
  }

  const allSlots = generateSlots(hours.open, hours.close, duration)

  // Bloklanmış saatler (işletme geneli + personele özel)
  let blockedQuery = supabase
    .from('blocked_slots')
    .select('start_time, end_time, staff_id')
    .eq('business_id', params.id)
    .eq('date', date)

  const { data: blockedRaw } = await blockedQuery

  // İşletme geneli bloklar (staff_id null) + seçili personele özel bloklar
  const blockedSlots = (blockedRaw || []).filter(b =>
    b.staff_id === null || b.staff_id === staffId
  )

  if (staffId) {
    // Belirli personel için: vardiya izni var mı kontrol et
    const { data: shiftOff } = await supabase
      .from('shifts')
      .select('shift_type')
      .eq('business_id', params.id)
      .eq('staff_id', staffId)
      .eq('shift_date', date)
      .eq('shift_type', 'off')
      .maybeSingle()

    if (shiftOff) {
      return NextResponse.json({ slots: [], message: 'Personel bu gün izinli' })
    }

    // Personelin randevularını çek
    const { data: existing } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('business_id', params.id)
      .eq('staff_id', staffId)
      .eq('appointment_date', date)
      .in('status', ['pending', 'confirmed'])
      .is('deleted_at', null)

    const available = allSlots.filter(s => {
      const slotMin = toMinutes(s)
      return !hasConflict(slotMin, duration, existing || []) &&
             !isBlockedSlot(slotMin, duration, blockedSlots)
    })
    return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
  }

  // "Herhangi bir personel" modu
  const { data: staffList } = await supabase
    .from('staff_members')
    .select('id')
    .eq('business_id', params.id)
    .eq('is_active', true)

  if (!staffList || staffList.length === 0) {
    // Personel yoksa işletme geneli çakışma kontrolü
    const { data: existing } = await supabase
      .from('appointments')
      .select('start_time, end_time')
      .eq('business_id', params.id)
      .eq('appointment_date', date)
      .in('status', ['pending', 'confirmed'])
      .is('deleted_at', null)

    const available = allSlots.filter(s => {
      const slotMin = toMinutes(s)
      return !hasConflict(slotMin, duration, existing || []) &&
             !isBlockedSlot(slotMin, duration, blockedSlots)
    })
    return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
  }

  const staffIds = staffList.map(s => s.id)

  const { data: allAppts } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('business_id', params.id)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null)
    .in('staff_id', staffIds)

  const { data: offShifts } = await supabase
    .from('shifts')
    .select('staff_id')
    .eq('business_id', params.id)
    .eq('shift_date', date)
    .eq('shift_type', 'off')
    .in('staff_id', staffIds)

  const offStaffIds = new Set((offShifts || []).map(s => s.staff_id))

  // Her slot için: en az 1 personelin müsait olup olmadığını kontrol et
  const available = allSlots.filter(slotStr => {
    const slotMin = toMinutes(slotStr)
    // Önce işletme geneli blok kontrolü
    if (isBlockedSlot(slotMin, duration, blockedSlots)) return false
    // En az 1 personel müsait mi?
    return staffIds.some(sid => {
      if (offStaffIds.has(sid)) return false
      // Bu personele özel blok var mı?
      const staffBlocked = (blockedRaw || []).filter(b => b.staff_id === sid)
      if (isBlockedSlot(slotMin, duration, staffBlocked)) return false
      const staffAppts = (allAppts || []).filter(a => a.staff_id === sid)
      return !hasConflict(slotMin, duration, staffAppts)
    })
  })

  return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
}
