import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { publicAppointmentPatchSchema, publicAppointmentDeleteSchema } from '@/lib/schemas'

// GET: Token ile randevu bilgilerini getir (public — auth gerektirmez)
export async function GET(_request: NextRequest, { params }: { params: { token: string } }) {
  if (!isValidUUID(params.token)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: appointment, error } = await admin
    .from('appointments')
    .select(`
      id, appointment_date, start_time, end_time, status, notes,
      manage_token, token_expires_at,
      customer:customers(name, phone),
      service:services(name, duration_minutes, price),
      staff:staff_members(name),
      business:businesses(id, name, phone, city, district, settings)
    `)
    .eq('manage_token', params.token)
    .single()

  if (error || !appointment) {
    return NextResponse.json({ error: 'Randevu bulunamadı veya link geçersiz' }, { status: 404 })
  }

  // Token süresi dolmuş mu kontrol et
  if (appointment.token_expires_at && new Date(appointment.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu bağlantının süresi dolmuş' }, { status: 410 })
  }

  // İptal edilmiş veya tamamlanmış randevu düzenlenemez
  const isEditable = !['cancelled', 'completed'].includes(appointment.status)

  return NextResponse.json({
    appointment: {
      id: appointment.id,
      date: appointment.appointment_date,
      startTime: appointment.start_time,
      endTime: appointment.end_time,
      status: appointment.status,
      notes: appointment.notes,
      isEditable,
      customer: Array.isArray(appointment.customer) ? appointment.customer[0] : appointment.customer,
      service: Array.isArray(appointment.service) ? appointment.service[0] : appointment.service,
      staff: Array.isArray(appointment.staff) ? appointment.staff[0] : appointment.staff,
      business: Array.isArray(appointment.business) ? appointment.business[0] : appointment.business,
    },
  })
}

// PATCH: Randevu tarih/saat değiştir
export async function PATCH(request: NextRequest, { params }: { params: { token: string } }) {
  if (!isValidUUID(params.token)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Token doğrulama
  const { data: appointment } = await admin
    .from('appointments')
    .select('id, business_id, status, token_expires_at, service_id, staff_id, appointment_date, start_time, customers(name), services(name)')
    .eq('manage_token', params.token)
    .single()

  if (!appointment) return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })

  if (appointment.token_expires_at && new Date(appointment.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu bağlantının süresi dolmuş' }, { status: 410 })
  }

  if (['cancelled', 'completed'].includes(appointment.status)) {
    return NextResponse.json({ error: 'Bu randevu artık düzenlenemez' }, { status: 400 })
  }

  const rl = checkRateLimit(request, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  const patchResult = await validateBody(request, publicAppointmentPatchSchema)
  if (!patchResult.ok) return patchResult.response
  const { date, startTime, endTime } = patchResult.data

  // Müsaitlik kontrolü (aynı personel, aynı saat)
  if (appointment.staff_id) {
    const { data: conflicts } = await admin
      .from('appointments')
      .select('id')
      .eq('business_id', appointment.business_id)
      .eq('staff_id', appointment.staff_id)
      .eq('appointment_date', date)
      .neq('id', appointment.id)
      .not('status', 'eq', 'cancelled')
      .lt('start_time', endTime)
      .gt('end_time', startTime)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'Bu saat dilimi dolu. Lütfen başka bir saat seçin.' }, { status: 409 })
    }
  }

  const { error } = await admin
    .from('appointments')
    .update({
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
    })
    .eq('id', appointment.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bildirim: müşteri randevuyu değiştirdi
  const custName = (Array.isArray(appointment.customers) ? appointment.customers[0] : appointment.customers)?.name || 'Müşteri'
  const svcName = (Array.isArray(appointment.services) ? appointment.services[0] : appointment.services)?.name || ''
  try {
    await admin.from('notifications').insert({
      business_id: appointment.business_id,
      type: 'appointment',
      title: 'Randevu Değiştirildi',
      body: `${custName} — ${svcName} — ${date} ${startTime}`,
      is_read: false,
    })
  } catch { /* bildirim hatası işlemi etkilemez */ }

  return NextResponse.json({ success: true, message: 'Randevu güncellendi' })
}

// DELETE: Randevu iptal
export async function DELETE(request: NextRequest, { params }: { params: { token: string } }) {
  if (!isValidUUID(params.token)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: appointment } = await admin
    .from('appointments')
    .select('id, business_id, status, token_expires_at, appointment_date, start_time, customers(name), services(name)')
    .eq('manage_token', params.token)
    .single()

  if (!appointment) return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })

  if (appointment.token_expires_at && new Date(appointment.token_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu bağlantının süresi dolmuş' }, { status: 410 })
  }

  if (['cancelled', 'completed'].includes(appointment.status)) {
    return NextResponse.json({ error: 'Bu randevu zaten iptal edilmiş veya tamamlanmış' }, { status: 400 })
  }

  const rl = checkRateLimit(request, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  const rawBody = await request.json().catch(() => ({}))
  const deleteResult = publicAppointmentDeleteSchema.safeParse(rawBody)
  const cancellationReason = deleteResult.success && deleteResult.data.reason
    ? deleteResult.data.reason
    : 'Müşteri tarafından iptal edildi'

  const { error } = await admin
    .from('appointments')
    .update({
      status: 'cancelled',
      cancellation_reason: cancellationReason,
    })
    .eq('id', appointment.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Bildirim: müşteri randevuyu iptal etti
  const custName = (Array.isArray(appointment.customers) ? appointment.customers[0] : appointment.customers)?.name || 'Müşteri'
  const svcName = (Array.isArray(appointment.services) ? appointment.services[0] : appointment.services)?.name || ''
  try {
    await admin.from('notifications').insert({
      business_id: appointment.business_id,
      type: 'appointment',
      title: 'Randevu İptal Edildi (Online)',
      body: `${custName} — ${svcName} — ${appointment.appointment_date} ${appointment.start_time}`,
      is_read: false,
    })
  } catch { /* bildirim hatası işlemi etkilemez */ }

  return NextResponse.json({ success: true, message: 'Randevu iptal edildi' })
}
