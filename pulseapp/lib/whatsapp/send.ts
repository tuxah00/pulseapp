// RLS bypass: cron/webhook bağlamlarından çağrılır, auth session olmayabilir; messages insert için admin gerekli
import { createAdminClient } from '@/lib/supabase/admin'
import { createLogger } from '@/lib/utils/logger'
import { formatTrPhone } from '@/lib/utils/phone'
import { sendMetaText, sendMetaTemplate } from '@/lib/whatsapp/meta-cloud'
import type { MessageType } from '@/types'

const log = createLogger({ module: 'whatsapp/send' })

interface SendWhatsAppParams {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType?: MessageType
  mediaUrl?: string
  staffId?: string
  staffName?: string
  templateName?: string
  templateParams?: Record<string, string>
}

interface SendWhatsAppResult {
  success: boolean
  messageSid?: string
  error?: string
}

type WhatsAppProvider = 'twilio' | 'meta'

/**
 * Unified WhatsApp mesaj gönderimi — provider dispatcher.
 *
 * `WHATSAPP_PROVIDER` env ile sağlayıcı seçilir: `twilio` (varsayılan) veya `meta`.
 * Her iki yolda da mesaj `messages` tablosuna kaydedilir (aynı şema).
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const provider: WhatsAppProvider = process.env.WHATSAPP_PROVIDER === 'meta' ? 'meta' : 'twilio'

  const result =
    provider === 'meta'
      ? await sendViaMeta(params)
      : await sendViaTwilio(params)

  if (result.success && result.messageSid) {
    await persistOutboundMessage({ params, messageId: result.messageSid, provider })
  }
  return result
}

async function sendViaMeta(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  // Meta sağlayıcısı şu an media göndermiyor (Faz 2.1 kapsamı) — parametre verilirse uyar
  if (params.mediaUrl) {
    log.warn({ businessId: params.businessId }, 'Meta provider mediaUrl desteklemiyor, text olarak gönderiliyor')
  }

  // T2.3 — Meta 24 saat kuralı: serbest text ancak son inbound mesajdan sonraki 24h içinde
  // gönderilebilir; dışında onaylı template zorunlu. Template yoksa send'i reddet +
  // staff alert düşür — sessiz fail yerine görünür sorun.
  if (!params.templateName && params.customerId) {
    const withinWindow = await isInsideMeta24hWindow(params.businessId, params.customerId)
    if (!withinWindow) {
      await notifyStaffTemplateNeeded(params)
      return { success: false, error: '24 saat penceresi dışı — onaylı template gerekli' }
    }
  }

  if (params.templateName) {
    const bodyParams = params.templateParams ? Object.values(params.templateParams) : undefined
    const res = await sendMetaTemplate({
      to: params.to,
      templateName: params.templateName,
      bodyParams,
    })
    return { success: res.success, messageSid: res.messageId, error: res.error }
  }

  const res = await sendMetaText({ to: params.to, body: params.body })
  return { success: res.success, messageSid: res.messageId, error: res.error }
}

async function sendViaTwilio(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const waNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !waNumber) {
    log.warn({ businessId: params.businessId }, 'Twilio WhatsApp credentials eksik, mesaj atlanıyor')
    return { success: false, error: 'WhatsApp yapılandırılmamış' }
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const toNormalized = formatTrPhone(params.to, 'e164')

  try {
    const formParams: Record<string, string> = {
      To: `whatsapp:${toNormalized}`,
      From: `whatsapp:${waNumber}`,
      Body: params.body,
    }
    if (params.mediaUrl) formParams.MediaUrl = params.mediaUrl

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formParams),
      },
    )

    const data = await response.json()
    if (!response.ok) {
      log.error({ businessId: params.businessId, twilio: data }, 'Twilio WhatsApp hatası')
      return { success: false, error: data.message || 'WhatsApp mesajı gönderilemedi' }
    }

    return { success: true, messageSid: data.sid }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'WhatsApp gönderilemedi'
    log.error({ err, businessId: params.businessId }, 'WhatsApp gönderme hatası')
    return { success: false, error: message }
  }
}

/** T2.3 — Son inbound WhatsApp mesajı 24 saat içinde mi? */
async function isInsideMeta24hWindow(businessId: string, customerId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('messages')
    .select('created_at')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('channel', 'whatsapp')
    .eq('direction', 'inbound')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return false
  const lastInboundMs = new Date(data.created_at as string).getTime()
  return Date.now() - lastInboundMs < 24 * 60 * 60_000
}

async function notifyStaffTemplateNeeded(params: SendWhatsAppParams): Promise<void> {
  const admin = createAdminClient()
  await admin.from('notifications').insert({
    business_id: params.businessId,
    type: 'ai_alert',
    title: 'WhatsApp 24 saat penceresi dışı',
    body: `Mesaj gönderilemedi — onaylı template gerekli. İçerik: "${params.body.slice(0, 120)}"`,
    related_id: params.customerId ?? null,
    related_type: params.customerId ? 'customer' : null,
  })
}

async function persistOutboundMessage(input: {
  params: SendWhatsAppParams
  messageId: string
  provider: WhatsAppProvider
}): Promise<void> {
  const { params, messageId, provider } = input
  const admin = createAdminClient()
  await admin.from('messages').insert({
    business_id: params.businessId,
    customer_id: params.customerId || null,
    direction: 'outbound',
    channel: 'whatsapp',
    message_type: params.messageType || 'text',
    content: params.body,
    // Twilio için eski kolonlar doldurulur; Meta için yalnızca meta_message_id
    twilio_sid: provider === 'twilio' ? messageId : null,
    twilio_status: provider === 'twilio' ? 'queued' : null,
    meta_message_id: messageId,
    staff_id: params.staffId || null,
    staff_name: params.staffName || null,
    template_name: params.templateName || null,
    template_params: params.templateParams || null,
  })
}

