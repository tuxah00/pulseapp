import twilio from 'twilio'

let _client: twilio.Twilio | null = null

export function getTwilioClient(): twilio.Twilio {
  if (!_client) {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN

    if (!accountSid || !authToken) {
      throw new Error('Twilio kimlik bilgileri eksik. TWILIO_ACCOUNT_SID ve TWILIO_AUTH_TOKEN ayarlanmalı.')
    }

    _client = twilio(accountSid, authToken)
  }
  return _client
}

export function getWhatsAppNumber(): string {
  const num = process.env.TWILIO_WHATSAPP_NUMBER
  if (!num) throw new Error('TWILIO_WHATSAPP_NUMBER ayarlanmamış.')
  return num.startsWith('whatsapp:') ? num : `whatsapp:${num}`
}

export function formatWhatsAppNumber(phone: string): string {
  let cleaned = phone.replace(/\s/g, '')

  if (cleaned.startsWith('0')) {
    cleaned = '+90' + cleaned.slice(1)
  } else if (!cleaned.startsWith('+')) {
    cleaned = '+90' + cleaned
  }

  return `whatsapp:${cleaned}`
}
