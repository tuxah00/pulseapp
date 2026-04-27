import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidUUID } from '@/lib/utils/validate'
import { validateBody } from '@/lib/api/validate'
import { portalAppointmentUpdateSchema } from '@/lib/schemas'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'

const TERMINAL_STATUSES = ['cancelled', 'completed', 'no_show'] as const

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const parsed = await validateBody(request, portalAppointmentUpdateSchema)
  if (!parsed.ok) return parsed.response
  const { date, startTime, endTime } = parsed.data

  const admin = createAdminClient()

  const { data: appointment } = await admin
    .from('appointments')
    .select('id, status, staff_id, appointment_date, start_time, services(name), customers(name)')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .single()

  if (!appointment) {
    return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
  }

  if ((TERMINAL_STATUSES as readonly string[]).includes(appointment.status)) {
    return NextResponse.json({ error: 'Bu randevu artık düzenlenemez' }, { status: 400 })
  }

  if (appointment.staff_id) {
    const { data: conflicts } = await admin
      .from('appointments')
      .select('id')
      .eq('business_id', businessId)
      .eq('staff_id', appointment.staff_id)
      .eq('appointment_date', date)
      .eq('start_time', startTime)
      .neq('id', appointment.id)
      .not('status', 'eq', 'cancelled')
      .is('deleted_at', null)

    if (conflicts && conflicts.length > 0) {
      return NextResponse.json({ error: 'Bu saat diliminde başka bir randevu var' }, { status: 409 })
    }
  }

  // Status 'pending' → işletme değişikliği yeniden onaylamalı
  const { error: updateError } = await admin
    .from('appointments')
    .update({
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 })
  }

  const reschSvc = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services
  const reschCst = Array.isArray(appointment.customers) ? appointment.customers[0] : appointment.customers

  await logPortalAction({
    customerId,
    businessId,
    action: 'appointment_reschedule',
    resource: 'appointment',
    resourceId: params.id,
    details: {
      customer_name: (reschCst as { name?: string } | null)?.name || null,
      service_name:  (reschSvc as { name?: string } | null)?.name || null,
      from: { date: appointment.appointment_date, time: appointment.start_time },
      to:   { date, time: startTime },
    },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: appointment } = await admin
    .from('appointments')
    .select('id, status, appointment_date, start_time, customer_package_id, services(name), customers(name)')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .single()

  if (!appointment) {
    return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
  }

  if ((TERMINAL_STATUSES as readonly string[]).includes(appointment.status)) {
    return NextResponse.json({ error: 'Bu randevu zaten iptal edilmiş veya tamamlanmış' }, { status: 400 })
  }

  const { error: updateError } = await admin
    .from('appointments')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'İptal işlemi başarısız' }, { status: 500 })
  }

  // Paket rezervasyon kaydını temizle — sessions_used hiç artmamıştı, sadece kaydı sil
  const apptWithPkg = appointment as typeof appointment & { customer_package_id?: string | null }
  if (apptWithPkg.customer_package_id) {
    await admin
      .from('package_usages')
      .delete()
      .eq('appointment_id', params.id)
  }

  const cancelSvc = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services
  const cancelCst = Array.isArray(appointment.customers) ? appointment.customers[0] : appointment.customers

  await logPortalAction({
    customerId,
    businessId,
    action: 'appointment_cancel',
    resource: 'appointment',
    resourceId: params.id,
    details: {
      customer_name: (cancelCst as { name?: string } | null)?.name || null,
      service_name: (cancelSvc as { name?: string } | null)?.name || null,
      date: appointment.appointment_date,
      time: appointment.start_time,
    },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ success: true })
}
