import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Meta (Facebook) webhook imza doğrulaması.
 * X-Hub-Signature-256 = "sha256=" + HMAC_SHA256(appSecret, rawBody)
 *
 * App Secret: Meta App → Settings → Basic → App Secret (META_WA_APP_SECRET)
 * Doğrulama başarısızsa 403 döner; başarılıysa null.
 */
export function verifyMetaWebhook(
  request: NextRequest,
  rawBody: string,
): NextResponse | null {
  const appSecret = process.env.META_WA_APP_SECRET
  if (!appSecret) {
    console.warn('META_WA_APP_SECRET tanımlı değil — webhook doğrulaması atlanıyor')
    return null
  }

  const signature = request.headers.get('x-hub-signature-256')
  if (!signature || !signature.startsWith('sha256=')) {
    return NextResponse.json({ error: 'İmza eksik' }, { status: 403 })
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(rawBody, 'utf8')
    .digest('hex')
  const received = signature.slice('sha256='.length)

  // timingSafeEqual aynı uzunluk şartı ister
  const expectedBuf = Buffer.from(expected, 'hex')
  const receivedBuf = Buffer.from(received, 'hex')
  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    return NextResponse.json({ error: 'Geçersiz imza' }, { status: 403 })
  }

  return null
}

/**
 * GET doğrulama (webhook subscribe): Meta konsolu "hub.verify_token" + challenge gönderir.
 * Doğru ise challenge'ı plain text olarak döndürmek zorundayız.
 */
export function handleMetaVerifyChallenge(request: NextRequest): NextResponse {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge') || ''

  const expectedToken = process.env.META_WA_VERIFY_TOKEN
  if (mode === 'subscribe' && expectedToken && token === expectedToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}
