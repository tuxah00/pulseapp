// app/api/consultations/[id]/convert/route.ts
// Ön konsültasyon talebini randevuya çevirir.

import { NextRequest, NextResponse } from 'next/server'
import { requireWritePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBooking } from '@/lib/booking/create-booking'
import { logAuditServer } from '@/lib/utils/audit'
import { consultationConvertSchema } from '@/lib/schemas'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(req, 'consultations')
  if (!auth.ok) return auth.response
  const { businessId, staffId, staffName } = auth.ctx

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const parsed = consultationConvertSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri.', details: parsed.error.flatten() }, { status: 400 })
  }

  const { serviceId, staffId: targetStaffId, date, startTime, notes } = parsed.data

  const supabase = createAdminClient()

  // Talebi getir
  const { data: request } = await supabase
    .from('consultation_requests')
    .select('id, customer_id, full_name, phone, status')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (!request) {
    return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 })
  }

  if (request.status === 'converted') {
    return NextResponse.json({ error: 'Bu talep zaten randevuya çevrilmiş.' }, { status: 409 })
  }

  // Randevu oluştur
  let result
  try {
    result = await createBooking(supabase, {
      businessId,
      name: request.full_name,
      phone: request.phone,
      serviceId,
      staffId: targetStaffId || staffId || null,
      date,
      startTime,
      notes: notes || null,
      source: 'dashboard',
      withManageToken: true,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Randevu oluşturulamadı.'
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const now = new Date().toISOString()

  // Talebi 'converted' olarak işaretle
  await supabase
    .from('consultation_requests')
    .update({
      status: 'converted',
      converted_appointment_id: result.appointmentId,
      converted_at: now,
      reviewed_by_staff_id: staffId,
      reviewed_by_staff_name: staffName,
      reviewed_at: now,
    })
    .eq('id', params.id)
    .eq('business_id', businessId)

  // Müşteriyi aktif yap (lead → aktif müşteri)
  await supabase
    .from('customers')
    .update({ is_active: true })
    .eq('id', request.customer_id)
    .eq('business_id', businessId)

  await logAuditServer({
    businessId, staffId, staffName,
    action: 'create',
    resource: 'appointment',
    resourceId: result.appointmentId,
    details: { fromConsultation: params.id, serviceId, date, startTime },
  })

  return NextResponse.json({
    ok: true,
    appointmentId: result.appointmentId,
    customerId: result.customerId,
    endTime: result.endTime,
  })
}
