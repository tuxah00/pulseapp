import { NextRequest, NextResponse } from 'next/server'
import { PORTAL_CUSTOMER_COOKIE, PORTAL_BUSINESS_COOKIE } from '@/lib/portal/auth'
import { isValidUUID } from '@/lib/utils/validate'

function clearCookies(response: NextResponse) {
  // Çerezler path='/' ile set edildiği için silerken de aynı path gerekir
  response.cookies.set(PORTAL_CUSTOMER_COOKIE, '', { path: '/', maxAge: 0 })
  response.cookies.set(PORTAL_BUSINESS_COOKIE, '', { path: '/', maxAge: 0 })
}

// DELETE — Portal oturumunu kapat (fetch tabanlı client kullanımı)
export async function DELETE(_request: NextRequest) {
  const response = NextResponse.json({ success: true })
  clearCookies(response)
  return response
}

// GET — Oturumu kapatıp login sayfasına yönlendir (layout/page redirect kullanımı)
export async function GET(request: NextRequest) {
  const requestedBusinessId = request.nextUrl.searchParams.get('businessId')
  const cookieBusinessId = request.cookies.get(PORTAL_BUSINESS_COOKIE)?.value
  const target = requestedBusinessId && isValidUUID(requestedBusinessId)
    ? requestedBusinessId
    : (cookieBusinessId && isValidUUID(cookieBusinessId) ? cookieBusinessId : null)

  const redirectUrl = target
    ? new URL(`/portal/${target}`, request.url)
    : new URL('/', request.url)

  const response = NextResponse.redirect(redirectUrl)
  clearCookies(response)
  return response
}
