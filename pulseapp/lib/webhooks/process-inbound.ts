/**
 * Ortak inbound mesaj akışı — SMS, Twilio WhatsApp ve Meta WhatsApp webhook'ları
 * bu fonksiyonu çağırır.
 *
 * Pipeline:
 * 1. Telefon numarasından müşteri/işletme çöz (orphan mesajlar düşürülür)
 * 2. `messages` tablosuna insert (provider-specific id kolonuna yazılır)
 * 3. EVET/HAYIR regex → randevu onay/iptal
 * 4. Kalan mesajlar → AI otomatik yanıt (guardrails + classify + reply)
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  handleAppointmentConfirmationReply,
  CONFIRM_REGEX,
  DECLINE_REGEX,
} from '@/lib/messaging/appointment-confirmation'
import { resolveInboundCustomer } from '@/lib/webhooks/resolve-customer'
import { handleInbound } from '@/lib/ai/auto-reply/handle-inbound'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ module: 'webhooks/process-inbound' })

export interface ProcessInboundParams {
  admin: SupabaseClient
  channel: 'sms' | 'whatsapp'
  /** Twilio: 'auto' (SMS/WA ikisini de kapsar). Meta: 'whatsapp'. */
  confirmationChannel: 'auto' | 'whatsapp' | 'sms'
  from: string
  messageBody: string
  /** Provider tarafından üretilen mesaj ID'si — Twilio SID veya Meta WAMID. */
  providerMessageId: string
  /** Hangi kolona yazılacak: Twilio için 'twilio_sid', Meta için 'meta_message_id'. */
  providerIdField: 'twilio_sid' | 'meta_message_id'
}

export async function processInboundMessage(params: ProcessInboundParams): Promise<void> {
  const { admin, channel, confirmationChannel, from, messageBody, providerMessageId, providerIdField } = params

  if (!from || !messageBody) return

  const customer = await resolveInboundCustomer(admin, from)
  if (!customer) {
    // Müşteri bulunamadı — orphan mesaj güvenlik riski (saldırgan ilk işletmeyi spam'leyebilir).
    // İşletmeye yazmak yerine sadece logla ve düş.
    log.warn({ from, providerMessageId, channel }, 'Inbound webhook: bilinmeyen numara, mesaj düşürüldü')
    return
  }

  // Idempotent insert: Meta/Twilio retry ettiğinde aynı mesaj iki kez işlenmez.
  // Migration 067 ile meta_message_id / twilio_sid partial UNIQUE index var.
  const { data: inserted, error: insertErr } = await admin
    .from('messages')
    .upsert(
      {
        business_id: customer.business_id,
        customer_id: customer.id,
        direction: 'inbound',
        channel,
        message_type: 'text',
        content: messageBody,
        [providerIdField]: providerMessageId,
        twilio_status: 'received',
      },
      { onConflict: providerIdField, ignoreDuplicates: true },
    )
    .select('id')

  if (insertErr) {
    log.error({ err: insertErr, providerMessageId, channel }, 'Inbound mesaj kaydedilemedi')
    return
  }
  // ignoreDuplicates=true + boş data → mesaj zaten işlenmişti (retry)
  if (!inserted || inserted.length === 0) {
    log.warn({ providerMessageId, channel }, 'Duplicate inbound webhook — atlandı')
    return
  }

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
      confirmationChannel,
    )
    if (handled) return
  }

  await handleInbound({
    admin,
    channel,
    from,
    messageBody,
    businessId: customer.business_id,
    customerId: customer.id,
    customerName: customer.name,
  })
}

