import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'

// POST: Mevcut personel için şifre sıfırlama linki üret
// Sadece işletme sahibi kullanabilir; personelin user_id'si dolu olmalı
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { staff } = await resolveActiveStaffForApi(supabase, user.id, 'id, name, business_id, role, is_active')
  if (!staff || staff.role !== 'owner') {
    return NextResponse.json({ error: 'Sadece işletme sahibi şifre sıfırlama linki oluşturabilir' }, { status: 403 })
  }

  const { staffId } = await req.json()
  if (!staffId) return NextResponse.json({ error: 'staffId gerekli' }, { status: 400 })

  const admin = createAdminClient()

  // Personeli getir — aynı işletmeye ait olmalı
  const { data: targetStaff, error: staffErr } = await admin
    .from('staff_members')
    .select('id, user_id, email, name, role, business_id')
    .eq('id', staffId)
    .eq('business_id', staff.business_id)
    .maybeSingle()

  if (staffErr || !targetStaff) {
    return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
  }

  // Sadece sisteme dahil olmuş (user_id'li) personeller için çalışır
  if (!targetStaff.user_id) {
    return NextResponse.json(
      { error: 'Bu personel henüz sisteme dahil olmadı. Davet linki kullanın.' },
      { status: 400 }
    )
  }

  if (!targetStaff.email) {
    return NextResponse.json({ error: 'Personelin e-posta adresi yok' }, { status: 400 })
  }

  if (targetStaff.role === 'owner') {
    return NextResponse.json(
      { error: 'İşletme sahibine şifre sıfırlama linki gönderilemez' },
      { status: 403 }
    )
  }

  // Supabase Auth — recovery link üret
  // redirectTo: personel bu linke tıklayınca şifre güncelleme sayfasına gidecek
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.vercel.app'
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email: targetStaff.email,
    options: {
      redirectTo: `${appUrl}/auth/reset-password`,
    },
  })

  if (linkErr || !linkData?.properties?.action_link) {
    return NextResponse.json(
      { error: 'Şifre sıfırlama linki üretilemedi: ' + (linkErr?.message ?? 'Bilinmeyen hata') },
      { status: 500 }
    )
  }

  return NextResponse.json({ link: linkData.properties.action_link })
}
