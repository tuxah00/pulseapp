// lib/utils/temp-token.ts
// Kısa ömürlü (15 dk) imzalı token — public form aşamaları arası state taşır.
// Şifrelemez, yalnızca imzalar: payload görünür ama manipüle edilemez.

import { createHmac, timingSafeEqual, randomBytes } from 'crypto'

const SECRET = process.env.SUPABASE_SERVICE_ROLE_KEY || 'pulse-temp-token-secret'

function b64url(buf: Buffer | string): string {
  const b = typeof buf === 'string' ? Buffer.from(buf, 'utf8') : buf
  return b.toString('base64url')
}

function b64decode(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8')
}

export interface TempTokenPayload {
  businessId: string
  customerId: string
  exp: number // unix seconds
}

/** 15 dakika geçerli imzalı token üretir */
export function signTempToken(payload: Omit<TempTokenPayload, 'exp'>): string {
  const data: TempTokenPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 dk
  }
  const encodedPayload = b64url(JSON.stringify(data))
  const sig = createHmac('sha256', SECRET).update(encodedPayload).digest()
  const encodedSig = b64url(sig)
  return `${encodedPayload}.${encodedSig}`
}

/** Token'ı doğrular ve payload'ı döner. Geçersizse null döner. */
export function verifyTempToken(token: string): TempTokenPayload | null {
  try {
    const [encodedPayload, encodedSig] = token.split('.')
    if (!encodedPayload || !encodedSig) return null

    // İmza doğrula (timing-safe)
    const expectedSig = createHmac('sha256', SECRET).update(encodedPayload).digest()
    const actualSig = Buffer.from(encodedSig, 'base64url')
    if (expectedSig.length !== actualSig.length) return null
    if (!timingSafeEqual(expectedSig, actualSig)) return null

    // Payload parse
    const payload: TempTokenPayload = JSON.parse(b64decode(encodedPayload))

    // Süre kontrolü
    if (payload.exp < Math.floor(Date.now() / 1000)) return null

    return payload
  } catch {
    return null
  }
}
