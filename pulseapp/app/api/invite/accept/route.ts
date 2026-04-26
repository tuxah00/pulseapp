import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: davet kabul — kullanıcı henüz staff_members'da yok, token ile doğrulama + staff kaydı oluşturma
import { createAdminClient } from '@/lib/supabase/admin'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  // Oturum açmış kullanıcıyı doğrula — user_id client tarafından belirlenemez
  const authClient = createServerSupabaseClient()
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { token, user_id, name } = await req.json()
  if (!token || !user_id || !name) {
    return NextResponse.json({ error: 'Eksik bilgi' }, { status: 400 })
  }

  // user_id mutlaka oturum açmış kullanıcıyla aynı olmalı
  if (user_id !== user.id) {
    return NextResponse.json({ error: 'Yetkisiz: kullanıcı doğrulaması başarısız' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Validate invitation
  const { data: invitation, error: invErr } = await admin
    .from('staff_invitations')
    .select('id, business_id, role, email, expires_at, used_at, staff_id')
    .eq('token', token)
    .single()

  if (invErr || !invitation) return NextResponse.json({ error: 'Geçersiz token' }, { status: 404 })
  if (invitation.used_at) return NextResponse.json({ error: 'Bu davet zaten kullanıldı' }, { status: 410 })
  if (new Date(invitation.expires_at) < new Date()) return NextResponse.json({ error: 'Davet süresi dolmuş' }, { status: 410 })

  // E-posta kontrolü: davet belirli bir e-postaya yönelikse eşleşme zorunlu.
  // E-posta belirtilmeden oluşturulan "genel davet linki" ise kontrol atlanır —
  // token zaten yeterince rastgele (UUID), link kendisi sır görevi görür.
  if (invitation.email) {
    if (!user.email || invitation.email.toLowerCase() !== user.email.toLowerCase()) {
      return NextResponse.json({ error: 'Bu davet farklı bir e-posta için oluşturulmuş' }, { status: 403 })
    }
  }

  // Duplicate koruması: aynı user + business için ikinci personel kaydı açılamaz
  const { data: existingStaff } = await admin
    .from('staff_members')
    .select('id')
    .eq('user_id', user_id)
    .eq('business_id', invitation.business_id)
    .maybeSingle()

  if (existingStaff) {
    return NextResponse.json({ error: 'Bu işletmede zaten personelsiniz' }, { status: 409 })
  }

  // Davet, mevcut bir staff_member kaydına bağlıysa: yeni satır INSERT etme,
  // sadece o satıra user_id + name ata. Yetki/etiket/hizmet atamaları korunur.
  if (invitation.staff_id) {
    const { data: targetStaff, error: targetErr } = await admin
      .from('staff_members')
      .select('id, user_id')
      .eq('id', invitation.staff_id)
      .eq('business_id', invitation.business_id)
      .maybeSingle()

    if (targetErr || !targetStaff) {
      return NextResponse.json({ error: 'Davet bağlı personel kaydı bulunamadı' }, { status: 404 })
    }
    if (targetStaff.user_id) {
      return NextResponse.json({ error: 'Bu personel zaten sisteme dahil olmuş' }, { status: 409 })
    }

    const { error: updateErr } = await admin
      .from('staff_members')
      .update({ user_id, name })
      .eq('id', invitation.staff_id)

    if (updateErr) {
      return NextResponse.json({ error: 'Personel güncellemesi başarısız: ' + updateErr.message }, { status: 500 })
    }
  } else {
    // Klasik akış: yeni staff_member satırı oluştur
    const { error: staffErr } = await admin.from('staff_members').insert({
      business_id: invitation.business_id,
      user_id,
      name,
      role: invitation.role,
      is_active: true,
      permissions: null, // Use role defaults
    })

    if (staffErr) return NextResponse.json({ error: 'Personel kaydı oluşturulamadı: ' + staffErr.message }, { status: 500 })
  }

  // Mark invitation as used
  await admin.from('staff_invitations').update({ used_at: new Date().toISOString() }).eq('id', invitation.id)

  return NextResponse.json({ success: true })
}
