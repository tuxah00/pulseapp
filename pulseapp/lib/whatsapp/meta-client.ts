const GRAPH_API_VERSION = 'v21.0'
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`

export interface MetaSendResult {
  success: boolean
  messageId?: string
  error?: string
}

interface MetaMessageResponse {
  messaging_product: string
  contacts: Array<{ input: string; wa_id: string }>
  messages: Array<{ id: string }>
}

interface MetaErrorResponse {
  error: {
    message: string
    type: string
    code: number
    error_subcode?: number
    fbtrace_id: string
  }
}

export function formatPhoneForMeta(phone: string): string {
  let cleaned = phone.replace(/[\s\-()whatsapp:]/g, '')

  if (cleaned.startsWith('0')) {
    cleaned = '90' + cleaned.slice(1)
  } else if (cleaned.startsWith('+')) {
    cleaned = cleaned.slice(1)
  }

  if (!cleaned.startsWith('90') && cleaned.length === 10) {
    cleaned = '90' + cleaned
  }

  return cleaned
}

async function metaApiRequest<T>(
  url: string,
  accessToken: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  const data = await response.json()

  if (!response.ok) {
    const err = data as MetaErrorResponse
    throw new Error(
      err.error?.message || `Meta API hatası: ${response.status}`,
    )
  }

  return data as T
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  text: string,
): Promise<MetaSendResult> {
  try {
    const toFormatted = formatPhoneForMeta(to)

    const result = await metaApiRequest<MetaMessageResponse>(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: toFormatted,
          type: 'text',
          text: { preview_url: false, body: text },
        }),
      },
    )

    return {
      success: true,
      messageId: result.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error('Meta WhatsApp mesaj gönderme hatası:', error)
    return { success: false, error: error.message }
  }
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  templateName: string,
  languageCode: string = 'tr',
  components?: Array<{
    type: 'body' | 'header'
    parameters: Array<{ type: 'text'; text: string }>
  }>,
): Promise<MetaSendResult> {
  try {
    const toFormatted = formatPhoneForMeta(to)

    const templatePayload: Record<string, any> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: toFormatted,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode },
      },
    }

    if (components && components.length > 0) {
      templatePayload.template.components = components
    }

    const result = await metaApiRequest<MetaMessageResponse>(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify(templatePayload),
      },
    )

    return {
      success: true,
      messageId: result.messages?.[0]?.id,
    }
  } catch (error: any) {
    console.error('Meta WhatsApp template mesaj hatası:', error)
    return { success: false, error: error.message }
  }
}

export async function markMessageRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string,
): Promise<boolean> {
  try {
    await metaApiRequest(
      `${GRAPH_API_BASE}/${phoneNumberId}/messages`,
      accessToken,
      {
        method: 'POST',
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          status: 'read',
          message_id: messageId,
        }),
      },
    )
    return true
  } catch (error: any) {
    console.error('Okundu bildirimi hatası:', error)
    return false
  }
}

export interface BusinessProfileInfo {
  about?: string
  address?: string
  description?: string
  email?: string
  vertical?: string
  websites?: string[]
  profile_picture_url?: string
}

export async function getBusinessProfile(
  phoneNumberId: string,
  accessToken: string,
): Promise<BusinessProfileInfo | null> {
  try {
    const data = await metaApiRequest<{
      data: BusinessProfileInfo[]
    }>(
      `${GRAPH_API_BASE}/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,vertical,websites,profile_picture_url`,
      accessToken,
    )
    return data.data?.[0] || null
  } catch (error: any) {
    console.error('İşletme profil bilgisi çekme hatası:', error)
    return null
  }
}

export interface PhoneNumberInfo {
  id: string
  display_phone_number: string
  verified_name: string
  quality_rating: string
  messaging_limit?: string
}

export async function getPhoneNumberInfo(
  phoneNumberId: string,
  accessToken: string,
): Promise<PhoneNumberInfo | null> {
  try {
    return await metaApiRequest<PhoneNumberInfo>(
      `${GRAPH_API_BASE}/${phoneNumberId}?fields=id,display_phone_number,verified_name,quality_rating`,
      accessToken,
    )
  } catch (error: any) {
    console.error('Telefon numarası bilgisi çekme hatası:', error)
    return null
  }
}

export function verifyWebhookSignature(
  payload: string,
  signature: string,
  appSecret: string,
): boolean {
  const crypto = require('crypto')
  const expectedSignature =
    'sha256=' +
    crypto.createHmac('sha256', appSecret).update(payload).digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature),
  )
}

export async function exchangeCodeForToken(code: string): Promise<{
  accessToken: string
  expiresIn?: number
}> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET

  if (!appId || !appSecret) {
    throw new Error('META_APP_ID ve META_APP_SECRET ayarlanmalı.')
  }

  const url = new URL(`${GRAPH_API_BASE}/oauth/access_token`)
  url.searchParams.set('client_id', appId)
  url.searchParams.set('client_secret', appSecret)
  url.searchParams.set('code', code)

  const response = await fetch(url.toString())
  const data = await response.json()

  if (!response.ok || data.error) {
    throw new Error(data.error?.message || 'Token değişimi başarısız.')
  }

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}

export async function getWABAPhoneNumbers(
  wabaId: string,
  accessToken: string,
): Promise<PhoneNumberInfo[]> {
  try {
    const data = await metaApiRequest<{ data: PhoneNumberInfo[] }>(
      `${GRAPH_API_BASE}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,quality_rating`,
      accessToken,
    )
    return data.data || []
  } catch (error: any) {
    console.error('WABA telefon numaraları çekme hatası:', error)
    return []
  }
}

export async function subscribeToWebhooks(
  wabaId: string,
  accessToken: string,
): Promise<boolean> {
  try {
    await metaApiRequest(
      `${GRAPH_API_BASE}/${wabaId}/subscribed_apps`,
      accessToken,
      { method: 'POST' },
    )
    return true
  } catch (error: any) {
    console.error('Webhook abonelik hatası:', error)
    return false
  }
}
