import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTwilioWebhook } from '@/lib/webhooks/verify-twilio'
import { processInboundMessage } from '@/lib/webhooks/process-inbound'

/**
 * Twilio WhatsApp inbound webhook (Twilio WA Sandbox / Production).
 * Meta Cloud API provider için ayrı endpoint: `/api/webhooks/whatsapp-meta`.
 *
 * Twilio, WhatsApp mesajlarını SMS ile aynı formatta gönderir;
 * fark: From/To alanları `whatsapp:+90...` formatındadır.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()

  const webhookErr = verifyTwilioWebhook(request, body)
  if (webhookErr) return webhookErr

  const params = new URLSearchParams(body)
  const rawFrom = params.get('From') || ''
  const messageBody = params.get('Body') || ''
  const messageSid = params.get('MessageSid') || ''

  // whatsapp: prefix'ini temizle
  const from = rawFrom.replace('whatsapp:', '')

  if (!from || !messageBody) {
    return new NextResponse('OK', { status: 200 })
  }

  await processInboundMessage({
    admin: createAdminClient(),
    channel: 'whatsapp',
    confirmationChannel: 'whatsapp',
    from,
    messageBody,
    providerMessageId: messageSid,
    providerIdField: 'twilio_sid',
  })

  return new NextResponse('OK', { status: 200 })
}
