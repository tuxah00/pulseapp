import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyTwilioWebhook } from '@/lib/webhooks/verify-twilio'
import { processInboundMessage } from '@/lib/webhooks/process-inbound'

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

  await processInboundMessage({
    admin: createAdminClient(),
    channel: 'sms',
    confirmationChannel: 'auto',
    from,
    messageBody,
    providerMessageId: messageSid,
    providerIdField: 'twilio_sid',
  })

  return new NextResponse('OK', { status: 200 })
}
