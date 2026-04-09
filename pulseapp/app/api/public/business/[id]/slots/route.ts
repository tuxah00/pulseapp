import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { WorkingHours } from '@/types'

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

/** Bir listedeki randevulardan dolu minute-set'i döndürür */
function occupiedMinutes(appointments: { start_time: string; end_time: string }[]): Set<number> {
  const set = new Set<number>()
  for (const appt of appointments) {
    const [sh, sm] = appt.start_time.split(':').map(Number)
    const [eh, em] = appt.end_time.split(':').map(Number)
    let cur = sh * 60 + sm
    while (cur < eh * 60 + em) {
      set.add(cur)
      cur += 30
    }
  }
  return set
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const durationStr = searchParams.get('duration')
  const staffId = searchParams.get('staffId') // belirli personel veya null (herhangi)

  if (!date || !durationStr) {
    return NextResponse.json({ error: 'date ve duration gerekli' }, { status: 400 })
  }

  const duration = parseInt(durationStr, 10)
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

    const occupied = occupiedMinutes(existing || [])
    const slotMinutes = (s: string) => {
      const [h, m] = s.split(':').map(Number)
      return h * 60 + m
    }
    const available = allSlots.filter(s => !occupied.has(slotMinutes(s)))
    return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
  }

  // "Herhangi bir personel" modu
  // Aktif personel listesini çek
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

    const occupied = occupiedMinutes(existing || [])
    const slotMinutes = (s: string) => {
      const [h, m] = s.split(':').map(Number)
      return h * 60 + m
    }
    const available = allSlots.filter(s => !occupied.has(slotMinutes(s)))
    return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
  }

  // Her personel için müsait slotları hesapla, union al (en az 1 personel müsaitse slot açık)
  const staffIds = staffList.map(s => s.id)

  // Tüm personelin o günkü randevularını tek sorguda çek
  const { data: allAppts } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('business_id', params.id)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed'])
    .in('staff_id', staffIds)

  // İzin günlerini çek
  const { data: offShifts } = await supabase
    .from('shifts')
    .select('staff_id')
    .eq('business_id', params.id)
    .eq('shift_date', date)
    .eq('shift_type', 'off')
    .in('staff_id', staffIds)

  const offStaffIds = new Set((offShifts || []).map(s => s.staff_id))

  const slotMinutes = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return h * 60 + m
  }

  // Her slot için: en az 1 personelin müsait olup olmadığını kontrol et
  const available = allSlots.filter(slotStr => {
    const slotMin = slotMinutes(slotStr)
    return staffIds.some(sid => {
      if (offStaffIds.has(sid)) return false // bu personel izinli
      const staffAppts = (allAppts || []).filter(a => a.staff_id === sid)
      const occupied = occupiedMinutes(staffAppts)
      return !occupied.has(slotMin)
    })
  })

  return NextResponse.json({ slots: available, open: hours.open, close: hours.close })
}
