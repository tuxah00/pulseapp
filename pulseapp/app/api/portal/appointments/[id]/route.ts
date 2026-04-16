import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidUUID } from '@/lib/utils/validate'

const TERMINAL_STATUSES = ['cancelled', 'completed', 'no_show'] as const

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const body = await request.json().catch(() => null) as { date?: string; startTime?: string; endTime?: string } | null
  if (!body?.date || !body.startTime || !body.endTime) {
    return NextResponse.json({ error: 'Tarih ve saat zorunludur' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: appointment } = await admin
    .from('appointments')
    .select('id, status, staff_id, appointment_date, start_time')
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
      .eq('appointment_date', body.date)
      .eq('start_time', body.startTime)
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
      appointment_date: body.date,
      start_time: body.startTime,
      end_time: body.endTime,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)

  if (updateError) {
    return NextResponse.json({ error: 'Güncelleme başarısız' }, { status: 500 })
  }

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
    .select('id, status')
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

  return NextResponse.json({ success: true })
}
