import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { setPortalSessionCookies } from '@/lib/portal/auth'

export const dynamic = 'force-dynamic'

/**
 * GET /api/portal/owner-preview?businessId=<uuid>&customerId=<uuid|optional>
 *
 * İşletme sahibi/personeli, müşteri portalını önizlemek için bu endpoint'i kullanır.
 * - Supabase oturumunu doğrular (staff_members tablosunda aktif kayıt zorunlu)
 * - Belirtilen customerId varsa o müşteriyi kullanır; yoksa işletmenin en aktif müşterisi
 *   (total_visits DESC) seçilir
 * - Portal cookie'lerini set eder ve /portal/<businessId>/dashboard'a yönlendirir
 *
 * Tarayıcı navigasyonu için hata durumlarında JSON yerine redirect kullanılır.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerIdParam = searchParams.get('customerId')

  // Geçersiz businessId'de ana sayfaya düş
  if (!businessId || !isValidUUID(businessId)) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('redirect', `/api/portal/owner-preview?businessId=${businessId}`)
    return NextResponse.redirect(loginUrl)
  }

  const admin = createAdminClient()

  const [staffResult, businessResult] = await Promise.all([
    admin
      .from('staff_members')
      .select('id')
      .eq('user_id', user.id)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle(),
    admin
      .from('businesses')
      .select('is_active')
      .eq('id', businessId)
      .single(),
  ])

  const business = businessResult.data
  if (!business || business.is_active === false) {
    return NextResponse.redirect(new URL('/dashboard?preview_error=business_inactive', request.url))
  }

  if (!staffResult.data) {
    return NextResponse.redirect(new URL('/dashboard?preview_error=forbidden', request.url))
  }

  let targetCustomerId: string | null = null

  if (customerIdParam && isValidUUID(customerIdParam)) {
    const { data: specific } = await admin
      .from('customers')
      .select('id')
      .eq('id', customerIdParam)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()
    targetCustomerId = specific?.id ?? null
  }

  if (!targetCustomerId) {
    const { data: fallback } = await admin
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('total_visits', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    targetCustomerId = fallback?.id ?? null
  }

  if (!targetCustomerId) {
    const fallbackUrl = new URL(`/portal/${businessId}`, request.url)
    fallbackUrl.searchParams.set('no_customer', '1')
    return NextResponse.redirect(fallbackUrl)
  }

  const response = NextResponse.redirect(
    new URL(`/portal/${businessId}/dashboard`, request.url)
  )
  return setPortalSessionCookies(response, { customerId: targetCustomerId, businessId })
}
