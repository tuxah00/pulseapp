import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { buildActiveBusinessCookie } from '@/lib/auth/active-business'

/**
 * Aktif işletme seçimi — cookie setter.
 *
 * Kullanıcı birden fazla işletmede personel ise, hangisini "aktif" kabul
 * edeceğini bu endpoint ile belirler. Güvenlik için server, hedef businessId'nin
 * kullanıcının gerçekten aktif personeli olduğunu kontrol eder.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 })
  }

  let businessId: string | null = null
  try {
    const body = await request.json()
    businessId = typeof body?.businessId === 'string' ? body.businessId : null
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  if (!businessId) {
    return NextResponse.json({ error: 'İşletme seçilmedi' }, { status: 400 })
  }

  // Güvenlik: kullanıcının o işletmede aktif personel kaydı var mı?
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (!staff) {
    return NextResponse.json({ error: 'Bu işletmeye erişim yetkiniz yok' }, { status: 403 })
  }

  const cookie = buildActiveBusinessCookie(businessId)
  const response = NextResponse.json({ success: true })
  response.cookies.set(cookie.name, cookie.value, cookie.options)
  return response
}
