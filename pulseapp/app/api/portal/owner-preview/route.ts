import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { setPortalSessionCookies } from '@/lib/portal/auth'
import { getClientIp } from '@/lib/portal/audit'

export const dynamic = 'force-dynamic'

/**
 * GET /api/portal/owner-preview?businessId=<uuid>&customerId=<uuid>
 *
 * İşletme sahibi/personeli, müşteri portalını önizlemek için bu endpoint'i kullanır.
 * - Supabase oturumunu doğrular (staff_members tablosunda aktif kayıt zorunlu)
 * - **`customerId` ZORUNLU** — eskiden "en aktif müşteri" fallback'i vardı; güvenlik
 *   açısından kaldırıldı (rastgele müşterinin verisine erişim yaratıyordu).
 * - Geçersiz/eksik customerId → /dashboard'a hata query param'ı ile yönlendirir.
 * - Audit log: staff_id + previewed_customer_id + ip
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

  // customerId artık ZORUNLU — fallback yok
  if (!customerIdParam || !isValidUUID(customerIdParam)) {
    return NextResponse.redirect(
      new URL('/dashboard/customers?preview_error=customer_required', request.url)
    )
  }

  const supabase = createServerSupabaseClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set(
      'redirect',
      `/api/portal/owner-preview?businessId=${businessId}&customerId=${customerIdParam}`
    )
    return NextResponse.redirect(loginUrl)
  }

  const admin = createAdminClient()

  const [staffResult, businessResult] = await Promise.all([
    admin
      .from('staff_members')
      .select('id, name')
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

  // Hedef müşterinin gerçekten bu işletmeye ait olduğunu doğrula
  const { data: specific } = await admin
    .from('customers')
    .select('id')
    .eq('id', customerIdParam)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .maybeSingle()

  if (!specific) {
    return NextResponse.redirect(
      new URL('/dashboard/customers?preview_error=customer_not_found', request.url)
    )
  }

  const targetCustomerId = specific.id

  // Audit: staff'ın hangi müşteriyi önizlediği kaydedilir
  await admin.from('audit_logs').insert({
    business_id: businessId,
    staff_id: staffResult.data.id,
    staff_name: staffResult.data.name,
    actor_type: 'staff',
    actor_id: staffResult.data.id,
    action: 'portal_preview',
    resource: 'customer',
    resource_id: targetCustomerId,
    details: null,
    ip_address: getClientIp(request),
  }).then(() => undefined, () => undefined)

  const response = NextResponse.redirect(
    new URL(`/portal/${businessId}/dashboard`, request.url)
  )
  return setPortalSessionCookies(response, { customerId: targetCustomerId, businessId })
}
