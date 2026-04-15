import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

/**
 * Portal cookie-tabanlı oturum bilgisi.
 * /api/portal/direct-login veya /api/portal/verify tarafından set edilir.
 */
export interface PortalSession {
  customerId: string
  businessId: string
}

export const PORTAL_CUSTOMER_COOKIE = 'portal_customer_id'
export const PORTAL_BUSINESS_COOKIE = 'portal_business_id'

/**
 * Server Component ya da Server Action içinde portal oturumunu okur.
 * Oturum yoksa null döner.
 */
export function getPortalSession(): PortalSession | null {
  const store = cookies()
  const customerId = store.get(PORTAL_CUSTOMER_COOKIE)?.value
  const businessId = store.get(PORTAL_BUSINESS_COOKIE)?.value
  if (!customerId || !businessId) return null
  return { customerId, businessId }
}

/**
 * API route içinde (Request objesi üzerinden) portal oturumunu okur.
 */
export function getPortalSessionFromRequest(request: NextRequest): PortalSession | null {
  const customerId = request.cookies.get(PORTAL_CUSTOMER_COOKIE)?.value
  const businessId = request.cookies.get(PORTAL_BUSINESS_COOKIE)?.value
  if (!customerId || !businessId) return null
  return { customerId, businessId }
}

/**
 * TWILIO_ACCOUNT_SID ve TWILIO_AUTH_TOKEN set edilmişse SMS OTP akışı
 * zorunlu tutulur; yoksa direct-login kullanılır.
 * Tek kod iki senaryoyu destekler.
 */
export function shouldUseOtp(): boolean {
  return !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN
}
