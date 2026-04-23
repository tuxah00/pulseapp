import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import {
  handleAppointmentConfirmationReply,
  CONFIRM_REGEX,
  DECLINE_REGEX,
} from '@/lib/messaging/appointment-confirmation'
import { verifyTwilioWebhook } from '@/lib/webhooks/verify-twilio'
import { resolveInboundCustomer } from '@/lib/webhooks/resolve-customer'
import { createLogger } from '@/lib/utils/logger'
import { handleInbound } from '@/lib/ai/auto-reply/handle-inbound'

const log = createLogger({ route: 'api/webhooks/sms' })

/**
 * Twilio inbound SMS webhook
 * Twilio konsolunda SMS webhook URL'si olarak ayarlayın:
 * https://yourdomain.com/api/webhooks/sms
 */
export async function POST(request: NextRequest) {
  const body = await request.text()

  const webhookErr = verifyTwilioWebhook(request, body)
  if (webhookErr) return webhookErr

  const params = new URLSearchParams(body)

  const from = params.get('From') || ''
  const messageBody = params.get('Body') || ''
  const messageSid = params.get('MessageSid') || ''

  if (!from || !messageBody) {
    return new NextResponse('OK', { status: 200 })
  }

  const admin = createAdminClient()

  const customer = await resolveInboundCustomer(admin, from)
  if (!customer) {
    // Müşteri bulunamadı — orphan mesaj güvenlik riski (saldırgan ilk işletmeyi spam'leyebilir)
    // İşletmeye yazmak yerine sadece logla ve düş
    log.warn({ from, messageSid }, 'SMS webhook: bilinmeyen numara, mesaj düşürüldü')
    return new NextResponse('OK', { status: 200 })
  }

  // Mesajı kaydet
  await admin.from('messages').insert({
    business_id: customer.business_id,
    customer_id: customer.id,
    direction: 'inbound',
    channel: 'sms',
    message_type: 'text',
    content: messageBody,
    twilio_sid: messageSid,
    twilio_status: 'received',
  })

  // ── Randevu Onay Kontrolü (EVET / HAYIR) ──
  const trimmed = messageBody.trim().toUpperCase()
  const isConfirm = CONFIRM_REGEX.test(trimmed)
  const isDecline = DECLINE_REGEX.test(trimmed)

  if (isConfirm || isDecline) {
    const handled = await handleAppointmentConfirmationReply(
      admin,
      customer.id,
      customer.business_id,
      from,
      isConfirm,
      'auto',
    )
    if (handled) {
      return new NextResponse('OK', { status: 200 })
    }
  }

  // ── AI Otomatik Yanıt ──
  await handleInbound({
    admin,
    channel: 'sms',
    from,
    messageBody,
    businessId: customer.business_id,
    customerId: customer.id,
    customerName: customer.name,
  })

  return new NextResponse('OK', { status: 200 })
}
