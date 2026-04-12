import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

/**
 * CRON route'larında timing-safe auth doğrulaması.
 * Başarısızsa 401 NextResponse döner, başarılıysa null.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || !authHeader) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const expected = `Bearer ${cronSecret}`

  if (authHeader.length !== expected.length) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const a = Buffer.from(authHeader, 'utf-8')
  const b = Buffer.from(expected, 'utf-8')

  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  return null
}
