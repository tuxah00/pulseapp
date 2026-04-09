import { NextRequest, NextResponse } from 'next/server'

/**
 * In-memory rate limiter.
 *
 * Vercel serverless ortamında her instance kendi Map'ini tutar,
 * bu nedenle tam global limit sağlamaz ama abuse koruması için yeterlidir.
 * Üretim ortamında Redis (Upstash) ile değiştirilebilir.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

// Bellek sızıntısını önlemek için periyodik temizlik
const CLEANUP_INTERVAL = 60_000 // 1 dakika
let lastCleanup = Date.now()

function cleanup() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return
  lastCleanup = now
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}

interface RateLimitConfig {
  /** Zaman penceresi (ms) */
  windowMs: number
  /** Pencere başına maksimum istek */
  maxRequests: number
  /** Opsiyonel key prefix (farklı endpoint grupları için) */
  prefix?: string
}

/**
 * Rate limit kontrolü yapar.
 * Limit aşılırsa { limited: true, response } döner.
 *
 * Kullanım:
 * ```ts
 * const rl = checkRateLimit(req, { windowMs: 60_000, maxRequests: 10, prefix: 'ai' })
 * if (rl.limited) return rl.response
 * ```
 */
export function checkRateLimit(
  req: NextRequest,
  config: RateLimitConfig
): { limited: false } | { limited: true; response: NextResponse } {
  cleanup()

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || 'unknown'

  const key = `${config.prefix || 'global'}:${ip}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + config.windowMs })
    return { limited: false }
  }

  entry.count++

  if (entry.count > config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    return {
      limited: true,
      response: NextResponse.json(
        { error: 'Çok fazla istek. Lütfen biraz bekleyin.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(config.maxRequests),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      ),
    }
  }

  return { limited: false }
}

// Yaygın endpoint yapılandırmaları
export const RATE_LIMITS = {
  ai: { windowMs: 60_000, maxRequests: 10, prefix: 'ai' } as RateLimitConfig,
  messaging: { windowMs: 60_000, maxRequests: 30, prefix: 'msg' } as RateLimitConfig,
  publicBooking: { windowMs: 60_000, maxRequests: 20, prefix: 'book' } as RateLimitConfig,
  auth: { windowMs: 300_000, maxRequests: 10, prefix: 'auth' } as RateLimitConfig,
  general: { windowMs: 60_000, maxRequests: 60, prefix: 'gen' } as RateLimitConfig,
} as const
