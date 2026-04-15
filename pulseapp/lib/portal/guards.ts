import { NextRequest, NextResponse } from 'next/server'
import { getPortalSessionFromRequest, type PortalSession } from './auth'

/**
 * API route'da portal oturumunu zorunlu tutar.
 * Oturum yoksa 401 response döner; varsa session objesi döner.
 *
 * Kullanım:
 * ```ts
 * const guard = requirePortalSession(request)
 * if (guard instanceof NextResponse) return guard
 * const { customerId, businessId } = guard
 * ```
 */
export function requirePortalSession(request: NextRequest): PortalSession | NextResponse {
  const session = getPortalSessionFromRequest(request)
  if (!session) {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 })
  }
  return session
}
