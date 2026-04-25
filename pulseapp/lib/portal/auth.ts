import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'

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

/** Portal oturum çerezlerinin ömrü ve politikası — tek kaynak */
export const PORTAL_SESSION_MAX_AGE = 7 * 24 * 60 * 60 // 7 gün

/**
 * Response üzerine portal oturum çerezlerini (customerId + businessId) set eder.
 * Tüm portal giriş route'ları (direct-login, verify, owner-preview) bu helper'ı kullanmalı.
 */
export function setPortalSessionCookies(
  response: NextResponse,
  session: PortalSession
): NextResponse {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    // Portal API tek-origin (kendi domain'i). 'strict' ile CSRF yüzeyi kapatılır;
    // dış sitelerden kaynaklanan isteklerde cookie gönderilmez.
    sameSite: 'strict' as const,
    maxAge: PORTAL_SESSION_MAX_AGE,
    path: '/',
  }
  response.cookies.set(PORTAL_CUSTOMER_COOKIE, session.customerId, options)
  response.cookies.set(PORTAL_BUSINESS_COOKIE, session.businessId, options)
  return response
}
