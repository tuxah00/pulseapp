import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalAppointmentCreateSchema } from '@/lib/schemas'
import { checkWorkingHours } from '@/lib/booking/working-hours'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/appointments' })

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'all'

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  let query = admin
    .from('appointments')
    .select(`
      id, appointment_date, start_time, end_time, status, notes,
      services(id, name, price, duration_minutes),
      staff_members(id, name)
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)

  if (filter === 'upcoming') {
    query = query
      .gte('appointment_date', today)
      .in('status', ['pending', 'confirmed'])
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
  } else if (filter === 'past') {
    query = query
      .or(`appointment_date.lt.${today},status.in.(completed,cancelled,no_show)`)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(50)
  } else {
    query = query
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(100)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Randevular yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ appointments: data || [] })
}

/**
 * POST /api/portal/appointments
 *
 * Müşteri portal'dan online randevu oluşturur.
 * - Cookie üzerinden customerId + businessId çekilir
 * - Doğrudan INSERT yapılır (createBooking yerine) — müşteri datasını sıfırlamaz,
 *   appointment_source enum sorunu yaratmaz
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalAppointmentCreateSchema)
  if (!parsed.ok) return parsed.response
  const { serviceId, staffId = null, date, startTime, notes = null } = parsed.data

  const admin = createAdminClient()

  // Hizmet bilgisini çek — süre için
  const { data: service, error: svcErr } = await admin
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('id', serviceId)
    .eq('business_id', businessId)
    .single()

  if (svcErr || !service) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

  // Çalışma saati kontrolü
  const { data: business } = await admin
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .single()

  const whError = checkWorkingHours(
    business?.working_hours as Parameters<typeof checkWorkingHours>[0],
    date,
    startTime,
  )
  if (whError) {
    return NextResponse.json({ error: whError.error }, { status: whError.status })
  }

  // Geçmiş tarih reddi
  const requested = new Date(`${date}T${startTime}:00`)
  if (requested.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Geçmiş bir tarihe randevu oluşturulamaz' }, { status: 400 })
  }

  // Bitiş saati hesapla
  const [sh, sm] = startTime.split(':').map(Number)
  const endTotal = sh * 60 + sm + service.duration_minutes
  if (endTotal >= 24 * 60) {
    return NextResponse.json({ error: 'Randevu gece yarısını aşamaz' }, { status: 400 })
  }
  const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

  // Çakışma kontrolü
  let cq = admin
    .from('appointments')
    .select('id')
    .eq('business_id', businessId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
  if (staffId) cq = cq.eq('staff_id', staffId)

  const { data: conflicts } = await cq
  if (conflicts?.length) {
    return NextResponse.json({ error: 'Bu saat dolu. Lütfen başka bir saat seçin.' }, { status: 409 })
  }

  // Randevu INSERT — mevcut müşteri ID kullanılır, enum alanı dahil edilmez
  const apptData: Record<string, unknown> = {
    business_id: businessId,
    customer_id: customerId,
    service_id: serviceId,
    appointment_date: date,
    start_time: startTime,
    end_time: endTime,
    status: 'pending',
    notes: notes ?? null,
    reminder_24h_sent: false,
    reminder_2h_sent: false,
    review_requested: false,
  }
  if (staffId) apptData.staff_id = staffId

  const { data: appt, error: apptErr } = await admin
    .from('appointments')
    .insert(apptData)
    .select('id')
    .single()

  if (apptErr || !appt) {
    log.error({ apptErr, businessId, customerId }, 'portal appointment insert failed')
    return NextResponse.json({ error: 'Randevu oluşturulamadı' }, { status: 500 })
  }

  // Müşteri adını bildirim için çek
  const { data: customer } = await admin
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .single()

  // İşletmeye bildirim
  await admin.from('notifications').insert({
    business_id: businessId,
    type: 'appointment',
    title: 'Yeni Online Randevu',
    body: `${customer?.name || 'Müşteri'} — ${service.name} — ${date} ${startTime}`,
    related_id: appt.id,
    related_type: 'appointment',
    is_read: false,
  }).then(() => undefined, () => undefined)

  await logPortalAction({
    customerId,
    businessId,
    action: 'appointment_create',
    resource: 'appointment',
    resourceId: appt.id,
    details: { serviceId, staffId, date, startTime },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({
    appointment: {
      id: appt.id,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      service: { name: service.name, price: service.price },
    },
  })
}
