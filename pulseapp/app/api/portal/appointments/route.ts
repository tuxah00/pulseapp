import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalAppointmentCreateSchema } from '@/lib/schemas'
import { createBooking } from '@/lib/booking/create-booking'
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
 * - Hizmet süresi services tablosundan alınır
 * - Çalışma saati kontrolü + çakışma kontrolü createBooking içinde yapılır
 * - source='portal' olarak kaydedilir
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalAppointmentCreateSchema)
  if (!parsed.ok) return parsed.response
  const { serviceId, staffId = null, date, startTime, notes = null } = parsed.data

  const admin = createAdminClient()

  // Müşteri bilgisini çek (createBooking name+phone bekliyor)
  const { data: customer } = await admin
    .from('customers')
    .select('name, phone')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  if (!customer) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
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

  try {
    const result = await createBooking(admin, {
      businessId,
      name: customer.name,
      phone: customer.phone || '',
      serviceId,
      staffId,
      date,
      startTime,
      notes,
      source: 'portal',
    })

    await logPortalAction({
      customerId,
      businessId,
      action: 'appointment_create',
      resource: 'appointment',
      resourceId: result.appointmentId,
      details: { serviceId, staffId, date, startTime },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({
      appointment: {
        id: result.appointmentId,
        appointment_date: date,
        start_time: startTime,
        end_time: result.endTime,
        service: result.service,
      },
    })
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500
    const message = err instanceof Error ? err.message : 'Randevu oluşturulamadı'
    if (status >= 500) {
      log.error({ err, businessId, customerId }, 'createBooking failed')
    }
    return NextResponse.json({ error: message }, { status })
  }
}
