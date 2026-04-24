import { NextRequest, NextResponse } from 'next/server'
import twilio from 'twilio'

/**
 * Twilio webhook imza doğrulaması.
 * X-Twilio-Signature header'ını kontrol eder.
 * Doğrulanamazsa 403 döner, başarılıysa null.
 */
export function verifyTwilioWebhook(
  request: NextRequest,
  body: string
): NextResponse | null {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) {
    console.warn('TWILIO_AUTH_TOKEN tanımlı değil — webhook doğrulaması atlanıyor')
    return null
  }

  const signature = request.headers.get('x-twilio-signature')
  if (!signature) {
    return NextResponse.json({ error: 'İmza eksik' }, { status: 403 })
  }

  const url = request.url
  const params = Object.fromEntries(new URLSearchParams(body))

  const isValid = twilio.validateRequest(authToken, signature, url, params)
  if (!isValid) {
    return NextResponse.json({ error: 'Geçersiz imza' }, { status: 403 })
  }

  return null
}
