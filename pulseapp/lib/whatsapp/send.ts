import { createAdminClient } from '@/lib/supabase/admin'

interface SendWhatsAppParams {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType?: 'text' | 'template' | 'ai_generated' | 'system'
  mediaUrl?: string
}

interface SendWhatsAppResult {
  success: boolean
  messageSid?: string
  error?: string
}

/**
 * WhatsApp mesajı gönderme utility (Twilio WhatsApp API)
 * Mesajı Twilio üzerinden WhatsApp kanalıyla gönderir ve messages tablosuna kaydeder.
 *
 * Twilio WhatsApp sandbox: https://www.twilio.com/docs/whatsapp/sandbox
 * Production: Meta Business onayı + Twilio WA sender ayarı gerekir.
 */
export async function sendWhatsApp(params: SendWhatsAppParams): Promise<SendWhatsAppResult> {
  const { to, body, businessId, customerId, messageType = 'text', mediaUrl } = params

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const waNumber = process.env.TWILIO_WHATSAPP_NUMBER

  if (!accountSid || !authToken || !waNumber) {
    console.warn('Twilio WhatsApp credentials eksik, mesaj atlanıyor')
    return { success: false, error: 'WhatsApp yapılandırılmamış' }
  }

  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const toNormalized = normalizeWhatsAppNumber(to)

  try {
    const formParams: Record<string, string> = {
      To: `whatsapp:${toNormalized}`,
      From: `whatsapp:${waNumber}`,
      Body: body,
    }

    if (mediaUrl) {
      formParams.MediaUrl = mediaUrl
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(formParams),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio WhatsApp hatası:', data)
      return { success: false, error: data.message || 'WhatsApp mesajı gönderilemedi' }
    }

    // Messages tablosuna kaydet
    const admin = createAdminClient()
    await admin.from('messages').insert({
      business_id: businessId,
      customer_id: customerId || null,
      direction: 'outbound',
      channel: 'whatsapp',
      message_type: messageType,
      content: body,
      twilio_sid: data.sid,
      twilio_status: data.status,
      meta_message_id: data.sid,
    })

    return { success: true, messageSid: data.sid }
  } catch (err: any) {
    console.error('WhatsApp gönderme hatası:', err)
    return { success: false, error: err.message }
  }
}

/**
 * Telefon numarasını WhatsApp formatına normalize eder.
 * Twilio WA format: whatsapp:+905XXXXXXXXX
 */
export function normalizeWhatsAppNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('90') && cleaned.length === 12) return `+${cleaned}`
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+9${cleaned}`
  if (cleaned.length === 10) return `+90${cleaned}`
  if (!phone.startsWith('+')) return `+${cleaned}`
  return phone
}
