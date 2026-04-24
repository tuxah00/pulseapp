/**
 * Meta WhatsApp Cloud API client (Graph API v18.0)
 *
 * Twilio WhatsApp yerine doğrudan Meta'nın Cloud API'si üzerinden WA mesajı gönderir.
 * Avantaj: Twilio komisyonu yok — Meta'nın kendi fiyatlandırması (konuşma başına).
 *
 * Kurulum:
 * 1. Meta Business Manager → WhatsApp → API Setup
 * 2. "Phone number ID" al → `META_WA_PHONE_NUMBER_ID`
 * 3. System User access token oluştur (permanent) → `META_WA_ACCESS_TOKEN`
 * 4. Webhook → `/api/webhooks/whatsapp-meta`, verify token özel belirle → `META_WA_VERIFY_TOKEN`
 * 5. App Secret (webhook imza doğrulaması için) → `META_WA_APP_SECRET`
 */
import { createLogger } from '@/lib/utils/logger'
import { formatTrPhone } from '@/lib/utils/phone'

const log = createLogger({ module: 'whatsapp/meta-cloud' })

const GRAPH_API_VERSION = 'v18.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

interface MetaSendResult {
  success: boolean
  messageId?: string
  error?: string
}

interface MetaApiResponse {
  messaging_product?: 'whatsapp'
  contacts?: Array<{ input: string; wa_id: string }>
  messages?: Array<{ id: string; message_status?: string }>
  error?: {
    message: string
    type: string
    code: number
    fbtrace_id?: string
  }
}

function getMetaConfig() {
  const phoneNumberId = process.env.META_WA_PHONE_NUMBER_ID
  const accessToken = process.env.META_WA_ACCESS_TOKEN
  if (!phoneNumberId || !accessToken) return null
  return { phoneNumberId, accessToken }
}

async function metaFetch(
  path: string,
  init: RequestInit,
  accessToken: string,
): Promise<MetaApiResponse> {
  const response = await fetch(`${GRAPH_API_BASE}${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  })
  return (await response.json()) as MetaApiResponse
}

/**
 * Text mesajı gönderir. 24 saat kuralı: son gelen mesajdan sonraki 24 saat içinde
 * serbest metin gönderilebilir; dışarısında approved template gerekir.
 */
export async function sendMetaText(params: {
  to: string
  body: string
}): Promise<MetaSendResult> {
  const config = getMetaConfig()
  if (!config) {
    log.warn('Meta WA credentials eksik')
    return { success: false, error: 'Meta WhatsApp yapılandırılmamış' }
  }

  const to = formatTrPhone(params.to, 'digits')

  try {
    const data = await metaFetch(
      `/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'text',
          text: { body: params.body, preview_url: false },
        }),
      },
      config.accessToken,
    )

    if (data.error) {
      log.error({ meta: data.error }, 'Meta WA text hatası')
      return { success: false, error: data.error.message }
    }

    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Meta WA gönderilemedi'
    log.error({ err }, 'Meta WA text exception')
    return { success: false, error: message }
  }
}

/**
 * Onaylanmış template mesajı gönderir (24 saat kuralı dışında tek seçenek).
 * Template parametreleri Meta konsolunda tanımlı sırada gönderilir.
 */
export async function sendMetaTemplate(params: {
  to: string
  templateName: string
  languageCode?: string
  bodyParams?: string[]
}): Promise<MetaSendResult> {
  const config = getMetaConfig()
  if (!config) {
    return { success: false, error: 'Meta WhatsApp yapılandırılmamış' }
  }

  const to = formatTrPhone(params.to, 'digits')
  const components = params.bodyParams?.length
    ? [
        {
          type: 'body',
          parameters: params.bodyParams.map((text) => ({ type: 'text', text })),
        },
      ]
    : undefined

  try {
    const data = await metaFetch(
      `/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'template',
          template: {
            name: params.templateName,
            language: { code: params.languageCode || 'tr' },
            ...(components ? { components } : {}),
          },
        }),
      },
      config.accessToken,
    )

    if (data.error) {
      log.error({ meta: data.error, template: params.templateName }, 'Meta WA template hatası')
      return { success: false, error: data.error.message }
    }

    return { success: true, messageId: data.messages?.[0]?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Meta WA template gönderilemedi'
    log.error({ err }, 'Meta WA template exception')
    return { success: false, error: message }
  }
}

/**
 * Meta WhatsApp Cloud webhook inbound mesaj tipi.
 * `entry[].changes[].value.messages[]` içindeki her kayıt bu şekilde gelir.
 */
export interface MetaInboundMessage {
  id: string
  from: string
  timestamp: string
  type: 'text' | 'image' | 'audio' | 'video' | 'document' | 'location' | 'button' | 'interactive'
  text?: { body: string }
  button?: { text: string; payload?: string }
  interactive?: {
    type: string
    button_reply?: { id: string; title: string }
    list_reply?: { id: string; title: string }
  }
}

/**
 * Meta'nın çeşitli mesaj tiplerini tek satır gövdeye düşürür.
 * text → body, button/interactive → başlık, diğer medya → tip etiketi (ör. `[image]`).
 */
export function extractMetaMessageBody(msg: MetaInboundMessage): string {
  if (msg.text?.body) return msg.text.body
  if (msg.button?.text) return msg.button.text
  if (msg.interactive?.button_reply?.title) return msg.interactive.button_reply.title
  if (msg.interactive?.list_reply?.title) return msg.interactive.list_reply.title
  return `[${msg.type}]`
}
