import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyMetaWebhook, handleMetaVerifyChallenge } from '@/lib/webhooks/verify-meta'
import { processInboundMessage } from '@/lib/webhooks/process-inbound'
import { extractMetaMessageBody, type MetaInboundMessage } from '@/lib/whatsapp/meta-cloud'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/webhooks/whatsapp-meta' })

/** Replay koruması: webhook payload'daki en yeni mesajın timestamp'i ile now() arasında fark 5dk'dan büyükse düşür. */
const REPLAY_WINDOW_SECONDS = 300

/**
 * Meta WhatsApp Cloud API inbound webhook
 *
 * Meta Business Manager → WhatsApp → Configuration → Webhook URL:
 *   https://yourdomain.com/api/webhooks/whatsapp-meta
 *
 * GET: Meta'nın subscribe doğrulaması (hub.challenge)
 * POST: inbound mesajlar (messages + statuses)
 *
 * Payload:
 *   entry[0].changes[0].value = {
 *     messaging_product: 'whatsapp',
 *     metadata: { phone_number_id },
 *     contacts: [{ wa_id, profile: { name } }],
 *     messages: [{ id, from, timestamp, type, text: { body } }]
 *   }
 */
export async function GET(request: NextRequest) {
  return handleMetaVerifyChallenge(request)
}

interface MetaChangeValue {
  messaging_product?: string
  metadata?: { phone_number_id?: string; display_phone_number?: string }
  contacts?: Array<{ wa_id: string; profile?: { name?: string } }>
  messages?: MetaInboundMessage[]
  statuses?: Array<{ id: string; status: string; recipient_id: string }>
}

interface MetaWebhookPayload {
  object?: string
  entry?: Array<{
    id: string
    changes?: Array<{ field: string; value: MetaChangeValue }>
  }>
}

export async function POST(request: NextRequest) {
  const rawBody = await request.text()

  const webhookErr = verifyMetaWebhook(request, rawBody)
  if (webhookErr) return webhookErr

  let payload: MetaWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new NextResponse('OK', { status: 200 })
  }

  // Tek payload'da gelen tüm mesajları tek düzlemde topla (statuses yok sayılır — ileride delivery receipt için kullanılacak)
  const messages: MetaInboundMessage[] = []
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue
      if (change.value.messages) messages.push(...change.value.messages)
    }
  }

  // T1.3 — Replay attack koruması: en yeni mesaj timestamp'i 5dk'dan eskiyse reddet.
  // Meta timestamp unix-seconds string formatında gelir.
  if (messages.length > 0) {
    const nowSec = Math.floor(Date.now() / 1000)
    const maxTs = Math.max(...messages.map((m) => Number(m.timestamp) || 0))
    if (maxTs > 0 && Math.abs(nowSec - maxTs) > REPLAY_WINDOW_SECONDS) {
      log.warn({ maxTs, nowSec, delta: nowSec - maxTs }, 'Meta webhook replay reddedildi (timestamp eski)')
      return NextResponse.json({ error: 'Replay window aşıldı' }, { status: 403 })
    }
  }

  const admin = createAdminClient()

  // Mesajlar birbirinden bağımsız — paralel işle (Meta webhook timeout 20sn, AI yanıtı gecikebilir)
  await Promise.all(
    messages.map((msg) =>
      processInboundMessage({
        admin,
        channel: 'whatsapp',
        confirmationChannel: 'whatsapp',
        from: msg.from,
        messageBody: extractMetaMessageBody(msg),
        providerMessageId: msg.id,
        providerIdField: 'meta_message_id',
      }),
    ),
  )

  return new NextResponse('OK', { status: 200 })
}
