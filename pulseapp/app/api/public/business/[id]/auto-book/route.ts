import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { autoBookSchema } from '@/lib/schemas'
import type { WorkingHours } from '@/types'

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

function slotMinutes(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}

function formatTime(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`
}

/**
 * POST /api/public/business/[id]/auto-book
 *
 * 14 gün içinde en yakın müsait slot+personeli bulup atomik olarak randevu oluşturur.
 * Slots API'nin UNION mantığını ve personel atamasını tek istekte birleştirir.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const rl = checkRateLimit(req, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  const result = await validateBody(req, autoBookSchema)
  if (!result.ok) return result.response
  const { name, phone, serviceId, staffId, notes } = result.data

  const supabase = createAdminClient()

  // İşletme bilgisi
  const { data: business } = await supabase
    .from('businesses')
    .select('id, working_hours')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  // Hizmet bilgisi
  const { data: service } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('id', serviceId)
    .eq('business_id', params.id)
    .eq('is_active', true)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

  // Personel listesi
  let staffIds: string[]
  if (staffId) {
    // Belirli personel istendi
    const { data: staffMember } = await supabase
      .from('staff_members')
      .select('id, name')
      .eq('id', staffId)
      .eq('business_id', params.id)
      .eq('is_active', true)
      .single()

    if (!staffMember) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }
    staffIds = [staffMember.id]
  } else {
    const { data: staffList } = await supabase
      .from('staff_members')
      .select('id')
      .eq('business_id', params.id)
      .eq('is_active', true)

    staffIds = (staffList || []).map(s => s.id)
  }

  const workingHours = business.working_hours as WorkingHours
  const now = new Date()

  // 14 gün iterasyonu
  for (let d = 0; d < 14; d++) {
    const checkDate = new Date(now)
    checkDate.setDate(now.getDate() + d)
    const year = checkDate.getFullYear()
    const month = String(checkDate.getMonth() + 1).padStart(2, '0')
    const day = String(checkDate.getDate()).padStart(2, '0')
    const dateStr = `${year}-${month}-${day}`
    const dayKey = DAY_KEYS[checkDate.getDay()]
    const hours = workingHours[dayKey]

    if (!hours) continue // kapalı gün

    let slots = generateSlots(hours.open, hours.close, service.duration_minutes)

    // Bugünse geçmiş saatleri filtrele
    if (d === 0) {
      const nowMin = now.getHours() * 60 + now.getMinutes()
      slots = slots.filter(s => slotMinutes(s) > nowMin)
    }

    if (slots.length === 0) continue

    // Bu güne ait personel izin günlerini çek
    const { data: offShifts } = await supabase
      .from('shifts')
      .select('staff_id')
      .eq('business_id', params.id)
      .eq('shift_date', dateStr)
      .eq('shift_type', 'off')
      .in('staff_id', staffIds)

    const offStaffIds = new Set((offShifts || []).map(s => s.staff_id))
    const availableStaffIds = staffIds.filter(id => !offStaffIds.has(id))

    if (availableStaffIds.length === 0) continue

    // Bu güne ait tüm randevuları çek
    const { data: allAppts } = await supabase
      .from('appointments')
      .select('staff_id, start_time, end_time')
      .eq('business_id', params.id)
      .eq('appointment_date', dateStr)
      .in('status', ['pending', 'confirmed'])
      .is('deleted_at', null)
      .in('staff_id', availableStaffIds)

    // Her slot için müsait personel bul
    for (const slot of slots) {
      const sMin = slotMinutes(slot)
      const endMin = sMin + service.duration_minutes
      const endTime = formatTime(endMin)

      // Bitiş saati çalışma saati içinde mi?
      if (endTime > hours.close) continue

      for (const sid of availableStaffIds) {
        const staffAppts = (allAppts || []).filter(a => a.staff_id === sid)
        const occupied = occupiedMinutes(staffAppts)

        // Slot süresi boyunca tüm 30'ar dakikalık dilimler boş mu?
        let isFree = true
        for (let min = sMin; min < endMin; min += 30) {
          if (occupied.has(min)) {
            isFree = false
            break
          }
        }

        if (!isFree) continue

        // Müsait slot+personel bulundu — randevu oluştur
        const normalizedPhone = '+90' + phone

        // Müşteriyi bul veya oluştur
        const { data: existingCustomers } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', params.id)
          .eq('phone', normalizedPhone)
          .limit(1)

        let customerId: string

        if (existingCustomers && existingCustomers.length > 0) {
          customerId = existingCustomers[0].id
        } else {
          const { data: newCustomer, error: custErr } = await supabase
            .from('customers')
            .insert({
              business_id: params.id,
              name: name.trim(),
              phone: normalizedPhone,
              segment: 'new',
              total_visits: 0,
              total_revenue: 0,
              total_no_shows: 0,
              is_active: true,
            })
            .select('id')
            .single()

          if (custErr || !newCustomer) {
            return NextResponse.json({ error: 'Müşteri oluşturulamadı' }, { status: 500 })
          }
          customerId = newCustomer.id
        }

        // Personel adını çek
        const { data: staffInfo } = await supabase
          .from('staff_members')
          .select('name')
          .eq('id', sid)
          .single()

        // Randevu oluştur
        const { data: appointment, error: apptErr } = await supabase
          .from('appointments')
          .insert({
            business_id: params.id,
            customer_id: customerId,
            service_id: serviceId,
            staff_id: sid,
            appointment_date: dateStr,
            start_time: slot,
            end_time: endTime,
            status: 'pending',
            source: 'web',
            notes: notes || null,
            reminder_24h_sent: false,
            reminder_2h_sent: false,
            review_requested: false,
          })
          .select('id')
          .single()

        if (apptErr || !appointment) {
          return NextResponse.json({ error: 'Randevu oluşturulamadı' }, { status: 500 })
        }

        // Bildirim
        await supabase.from('notifications').insert({
          business_id: params.id,
          type: 'appointment',
          title: 'Yeni Online Randevu (Otomatik)',
          message: `${name} — ${service.name} — ${dateStr} ${slot}`,
          related_id: appointment.id,
          related_type: 'appointment',
          is_read: false,
        })

        return NextResponse.json({
          success: true,
          appointmentId: appointment.id,
          date: dateStr,
          startTime: slot,
          endTime,
          staffName: staffInfo?.name || null,
          serviceName: service.name,
        })
      }
    }
  }

  // 14 gün içinde müsait slot bulunamadı
  return NextResponse.json(
    { error: 'Önümüzdeki 14 gün içinde müsait randevu saati bulunamadı.' },
    { status: 404 }
  )
}
