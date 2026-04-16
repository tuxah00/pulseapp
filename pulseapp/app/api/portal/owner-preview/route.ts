import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

export const dynamic = 'force-dynamic'

/**
 * GET /api/portal/owner-preview?businessId=<uuid>&customerId=<uuid|optional>
 *
 * İşletme sahibi/personeli, müşteri portalını önizlemek için bu endpoint'i kullanır.
 * - Supabase oturumunu doğrular (staff_members tablosunda aktif kayıt zorunlu)
 * - Belirtilen customerId varsa o müşteriyi kullanır; yoksa işletmenin en aktif müşterisi
 *   (total_visits DESC) seçilir
 * - Portal cookie'lerini set eder ve /portal/<businessId>/dashboard'a yönlendirir
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerIdParam = searchParams.get('customerId')

  if (!businessId || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'Geçersiz businessId' }, { status: 400 })
  }

  // 1) Supabase dashboard oturumu zorunlu
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

  // 2) Personel/sahip yetkisi kontrolü
  const { data: staff } = await admin
    .from('staff_members')
    .select('id, business_id, is_active')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .maybeSingle()

  if (!staff) {
    return NextResponse.json(
      { error: 'Bu işletmeye erişim yetkiniz yok' },
      { status: 403 }
    )
  }

  // 3) İşletme hâlâ aktif mi?
  const { data: business } = await admin
    .from('businesses')
    .select('id, is_active')
    .eq('id', businessId)
    .single()

  if (!business || business.is_active === false) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  // 4) Önizlenecek müşteriyi seç
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

  // Müşteri yoksa login sayfasına bir uyarı ile yönlendir
  if (!targetCustomerId) {
    const fallbackUrl = new URL(`/portal/${businessId}`, request.url)
    fallbackUrl.searchParams.set('no_customer', '1')
    return NextResponse.redirect(fallbackUrl)
  }

  // 5) Portal cookie'lerini kur ve dashboard'a yönlendir
  const response = NextResponse.redirect(
    new URL(`/portal/${businessId}/dashboard`, request.url)
  )

  response.cookies.set('portal_customer_id', targetCustomerId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  response.cookies.set('portal_business_id', businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return response
}
