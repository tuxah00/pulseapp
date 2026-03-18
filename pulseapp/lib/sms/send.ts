import { createAdminClient } from '@/lib/supabase/admin'

interface SendSMSParams {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType?: 'text' | 'template' | 'ai_generated' | 'system'
}

interface SendSMSResult {
  success: boolean
  messageSid?: string
  error?: string
}

/**
 * SMS gönderme utility (Twilio)
 * Mesajı Twilio üzerinden gönderir ve messages tablosuna kaydeder.
 */
export async function sendSMS(params: SendSMSParams): Promise<SendSMSResult> {
  const { to, body, businessId, customerId, messageType = 'text' } = params

  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const fromNumber = process.env.TWILIO_PHONE_NUMBER

  if (!accountSid || !authToken || !fromNumber) {
    console.warn('Twilio credentials eksik, SMS atlanıyor')
    return { success: false, error: 'Twilio yapılandırılmamış' }
  }

  // Twilio REST API ile SMS gönder
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64')
  const toNormalized = normalizePhone(to)

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: toNormalized,
          From: fromNumber,
          Body: body,
        }),
      }
    )

    const data = await response.json()

    if (!response.ok) {
      console.error('Twilio SMS hatası:', data)
      return { success: false, error: data.message || 'SMS gönderilemedi' }
    }

    // Messages tablosuna kaydet
    const admin = createAdminClient()
    await admin.from('messages').insert({
      business_id: businessId,
      customer_id: customerId || null,
      direction: 'outbound',
      channel: 'sms',
      message_type: messageType,
      content: body,
      twilio_sid: data.sid,
      twilio_status: data.status,
    })

    return { success: true, messageSid: data.sid }
  } catch (err: any) {
    console.error('SMS gönderme hatası:', err)
    return { success: false, error: err.message }
  }
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.startsWith('90') && cleaned.length === 12) return `+${cleaned}`
  if (cleaned.startsWith('0') && cleaned.length === 11) return `+9${cleaned}`
  if (cleaned.length === 10) return `+90${cleaned}`
  if (!phone.startsWith('+')) return `+${cleaned}`
  return phone
}
