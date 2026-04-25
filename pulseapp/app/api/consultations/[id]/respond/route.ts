// app/api/consultations/[id]/respond/route.ts
// Hastaya WhatsApp/SMS yanıtı gönderir, opsiyonel olarak status günceller.

import { NextRequest, NextResponse } from 'next/server'
import { requireWritePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { logAuditServer } from '@/lib/utils/audit'
import { consultationRespondSchema } from '@/lib/schemas'
import { toE164Phone, normalizePhone } from '@/lib/utils/phone'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(req, 'consultations')
  if (!auth.ok) return auth.response
  const { businessId, staffId, staffName } = auth.ctx

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const parsed = consultationRespondSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 })
  }

  const { message, channel, updateStatus, decisionReason } = parsed.data

  const supabase = createAdminClient()

  const { data: request } = await supabase
    .from('consultation_requests')
    .select('id, phone, customer_id, status, full_name')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (!request) {
    return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 })
  }

  // Mesaj gönder
  const normalizedPhone = normalizePhone(request.phone)
  const e164 = toE164Phone(normalizedPhone)

  const result = await sendMessage({
    to: e164,
    body: message,
    businessId,
    customerId: request.customer_id,
    messageType: 'text',
    channel: channel as 'auto' | 'whatsapp' | 'sms',
    staffId,
    staffName,
  })

  // Status güncellemesi istenmiş ise
  if (updateStatus && updateStatus !== request.status) {
    const statusPayload: Record<string, unknown> = {
      status: updateStatus,
    }
    if (decisionReason !== undefined) statusPayload.decision_reason = decisionReason
    if (['suitable', 'not_suitable', 'needs_more_info'].includes(updateStatus)) {
      statusPayload.reviewed_by_staff_id = staffId
      statusPayload.reviewed_by_staff_name = staffName
      statusPayload.reviewed_at = new Date().toISOString()
    }
    await supabase
      .from('consultation_requests')
      .update(statusPayload)
      .eq('id', params.id)
      .eq('business_id', businessId)
  }

  await logAuditServer({
    businessId, staffId, staffName,
    action: 'send',
    resource: 'consultation_request',
    resourceId: params.id,
    details: { channel: result.channel, updateStatus: updateStatus || null },
  })

  return NextResponse.json({
    ok: true,
    channel: result.channel,
    success: result.success,
    error: result.error || null,
  })
}
