/**
 * Ortak inbound handler — SMS ve WhatsApp webhook'ları bunu çağırır.
 *
 * Akış:
 * 1. Guardrail kontrolü (mod, saat, cooldown, cap)
 * 2. Classify (GPT-4o Mini, ~150 token)
 * 3. Reply (whitelist şablonu veya smart GPT-4o Mini)
 * 4. Kanal üstünden gönder (SMS / WhatsApp)
 * 5. "staff dikkat" niyetleri için notifications kaydı
 *
 * Güvenlik: hiçbir yazma eylemi (create/update/delete) yapmaz. Sadece metin cevap.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendSMS } from '@/lib/sms/send'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { createLogger } from '@/lib/utils/logger'
import { checkGuardrails } from './guardrails'
import { classifyInbound } from './classify'
import { generateReply, withSignature, type BusinessContext, type AutoReplyMode } from './reply'
import { AUTO_REPLY_DEFAULTS } from './defaults'
import type { BusinessSettings, SectorType, WorkingHours } from '@/types'

const log = createLogger({ module: 'ai/auto-reply/handle-inbound' })

export interface HandleInboundParams {
  admin: SupabaseClient
  channel: 'sms' | 'whatsapp'
  /** Müşteri telefon numarası (+90... formatında, whatsapp: prefix'siz) */
  from: string
  /** Gelen mesaj gövdesi */
  messageBody: string
  businessId: string
  customerId: string
  customerName?: string
}

export interface HandleInboundResult {
  handled: boolean
  reason?: string
  intent?: string
  replySent?: boolean
}

interface BusinessRow {
  id: string
  name: string
  sector: SectorType
  phone: string | null
  address: string | null
  city: string | null
  district: string | null
  google_maps_url: string | null
  working_hours: WorkingHours | null
  settings: BusinessSettings | null
}

export async function handleInbound(params: HandleInboundParams): Promise<HandleInboundResult> {
  const { admin, channel, from, messageBody, businessId, customerId, customerName } = params

  // İşletme bağlamını tek sorguda çek
  const { data: business } = await admin
    .from('businesses')
    .select('id, name, sector, phone, address, city, district, google_maps_url, working_hours, settings')
    .eq('id', businessId)
    .single<BusinessRow>()

  if (!business) {
    return { handled: false, reason: 'business_not_found' }
  }

  // 1) Guardrails
  const guard = await checkGuardrails({
    admin,
    businessId,
    customerId,
    settings: business.settings,
  })
  if (!guard.allowed) {
    // T2.8 — Yanıtlanmayan mesaj için staff alert (spam sebebi: kullanıcı hatasıyla sessiz kalmasın)
    // Mod kapalıysa alert atma (istenen davranış), diğer blokajlarda personel görsün
    if (guard.reason !== 'ai_auto_reply_disabled' && guard.reason !== 'auto_reply_mode_off') {
      await insertUnansweredAlert(admin, {
        businessId, customerId, customerName,
        reason: guard.reason ?? 'guardrail',
        messageBody,
      })
    }
    return { handled: false, reason: guard.reason }
  }

  // Mod (whitelist/smart) — classify + (smart modunda) son mesajlar paralel çekilir
  const mode: AutoReplyMode = business.settings?.auto_reply_mode === 'smart' ? 'smart' : AUTO_REPLY_DEFAULTS.mode
  const recentMessagesPromise = mode === 'smart'
    ? admin
        .from('messages')
        .select('direction, content')
        .eq('business_id', businessId)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .limit(5)
    : Promise.resolve({ data: null })

  const [{ intent, confidence, summary }, recentRes] = await Promise.all([
    classifyInbound({
      message: messageBody,
      businessName: business.name,
      sector: business.sector,
    }),
    recentMessagesPromise,
  ])

  // T2.2 — Güvensiz sınıflandırma veya kritik niyetler → otomatik yanıt verme,
  // her durumda personel görsün. Şikayet/belirsiz durumlarda yanlış canned yanıt
  // müşteri memnuniyetini bozar; iptal/erteleme personel tarafından işlenmeli.
  const BLOCKED_AUTO_INTENTS = ['complaint', 'other', 'appointment_cancel', 'appointment_reschedule'] as const
  const isBlocked = (BLOCKED_AUTO_INTENTS as readonly string[]).includes(intent)
  if (confidence < 0.65 || isBlocked) {
    await insertStaffNotification(admin, {
      businessId, intent, summary, customerId, customerName, rawMessage: messageBody,
    })
    return { handled: false, reason: confidence < 0.65 ? 'low_confidence' : `blocked_intent:${intent}`, intent }
  }

  const recentMessages = ((recentRes.data ?? []) as Array<{ direction: 'inbound' | 'outbound'; content: string }>)
    .slice()
    .reverse()

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const businessCtx: BusinessContext = {
    id: business.id,
    name: business.name,
    sector: business.sector,
    phone: business.phone,
    address: business.address,
    city: business.city,
    district: business.district,
    googleMapsUrl: business.google_maps_url,
    workingHours: business.working_hours,
    bookingLink: `${appUrl}/book/${business.id}`,
  }

  const reply = await generateReply({
    intent,
    message: messageBody,
    mode,
    business: businessCtx,
    customerName,
    recentMessages,
  })

  // 4) Staff dikkat gerektiren niyetler → bildirim düşür (cevap gönderilse de gönderilmese de)
  if (reply.alertStaffOnly || reply.queueAction) {
    await insertStaffNotification(admin, {
      businessId,
      intent,
      summary,
      customerId,
      customerName,
      rawMessage: messageBody,
    })
  }

  if (reply.alertStaffOnly) {
    return { handled: true, intent, replySent: false, reason: 'staff_alert_only' }
  }

  if (!reply.text) {
    return { handled: true, intent, replySent: false, reason: 'no_reply_generated' }
  }

  // 5) Yanıtı gönder (şeffaflık etiketi ile)
  const signed = business.settings?.auto_reply_signature === false ? reply.text : withSignature(reply.text)
  const sendResult = channel === 'whatsapp'
    ? await sendWhatsApp({
        to: from,
        body: signed,
        businessId,
        customerId,
        messageType: 'ai_auto_reply',
      })
    : await sendSMS({
        to: from,
        body: signed,
        businessId,
        customerId,
        messageType: 'ai_auto_reply',
      })

  if (!sendResult.success) {
    log.error({ businessId, channel, error: sendResult.error }, 'Otomatik yanıt gönderilemedi')
    // T2.4 — Staff'a bildirim + retry için ai_pending_actions kuyruğuna eklenir
    await admin.from('notifications').insert({
      business_id: businessId,
      type: 'ai_alert',
      title: `Otomatik yanıt gönderilemedi: ${customerName || 'Müşteri'}`,
      body: `${channel.toUpperCase()} mesajına cevap gönderilemedi: ${sendResult.error || 'bilinmeyen hata'}. Mesaj: "${messageBody.slice(0, 120)}"`,
      related_id: customerId,
      related_type: 'customer',
    })
    await admin.from('ai_pending_actions').insert({
      business_id: businessId,
      customer_id: customerId,
      action_type: 'send_message',
      payload: { channel, to: from, body: signed, message_type: 'ai_auto_reply' },
      status: 'scheduled',
      scheduled_for: new Date(Date.now() + 5 * 60_000).toISOString(), // 5 dk sonra retry
      created_by: 'auto_reply_retry',
    }).then(() => undefined, () => undefined) // best-effort
    return { handled: true, intent, replySent: false, reason: 'send_failed' }
  }

  return { handled: true, intent, replySent: true }
}

// ─── Staff bildirimi ─────────────────────────────────────────────

const INTENT_LABELS: Record<string, string> = {
  appointment_request: 'Randevu talebi',
  appointment_cancel: 'İptal talebi',
  appointment_reschedule: 'Erteleme talebi',
  complaint: 'Şikayet',
}

async function insertStaffNotification(
  admin: SupabaseClient,
  params: {
    businessId: string
    intent: string
    summary: string
    customerId: string
    customerName?: string
    rawMessage: string
  },
) {
  const label = INTENT_LABELS[params.intent] ?? 'Mesaj'
  const title = `${label}: ${params.customerName ?? 'Müşteri'}`
  const body = params.summary || params.rawMessage.slice(0, 120)

  await admin.from('notifications').insert({
    business_id: params.businessId,
    type: 'ai_alert',
    title,
    body,
    related_id: params.customerId,
    related_type: 'customer',
  })
}

/** T2.8 — Guardrail'in bloke ettiği mesajlar için staff alert. */
async function insertUnansweredAlert(
  admin: SupabaseClient,
  params: {
    businessId: string
    customerId: string
    customerName?: string
    reason: string
    messageBody: string
  },
) {
  const REASON_LABELS: Record<string, string> = {
    outside_hours: 'saat dışı',
    cooldown: 'cooldown süresi',
    per_customer_cap: 'müşteri cap aşıldı',
    business_daily_cap: 'günlük cap aşıldı',
  }
  const reasonLabel = REASON_LABELS[params.reason] ?? params.reason
  await admin.from('notifications').insert({
    business_id: params.businessId,
    type: 'ai_alert',
    title: `Yanıtlanmayan mesaj: ${params.customerName || 'Müşteri'}`,
    body: `Sebep: ${reasonLabel}. Mesaj: "${params.messageBody.slice(0, 120)}"`,
    related_id: params.customerId,
    related_type: 'customer',
  })
}
