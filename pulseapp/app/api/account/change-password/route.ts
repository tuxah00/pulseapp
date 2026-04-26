import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createClient as createSbClient } from '@supabase/supabase-js'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'

/**
 * POST /api/account/change-password
 *
 * Oturum açmış kullanıcının kendi şifresini değiştirir.
 *
 * Body:
 *   { currentPassword: string, newPassword: string }
 *
 * Akış:
 *   1) Oturum kontrolü (server client)
 *   2) Re-auth: kullanıcının email'i + currentPassword ile geçici signInWithPassword
 *      (cookie'lere dokunmayan ayrı SDK instance'ı). Hatalıysa 403.
 *   3) supabase.auth.updateUser({ password: newPassword }) — server client'tan,
 *      mevcut oturum güncellenir.
 *   4) Audit log.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !user.email) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { currentPassword, newPassword } = body as { currentPassword?: string; newPassword?: string }

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Mevcut ve yeni şifre zorunlu' }, { status: 400 })
  }
  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return NextResponse.json({ error: 'Yeni şifre en az 6 karakter olmalı' }, { status: 400 })
  }
  if (currentPassword === newPassword) {
    return NextResponse.json({ error: 'Yeni şifre mevcut şifreden farklı olmalı' }, { status: 400 })
  }

  // Re-auth — geçici client (cookie'lere dokunmaz)
  const tempClient = createSbClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error: authError } = await tempClient.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  })
  if (authError) {
    return NextResponse.json({ error: 'Mevcut şifre hatalı' }, { status: 403 })
  }

  // Şifreyi güncelle (mevcut oturum üzerinden)
  const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
  if (updateError) {
    return NextResponse.json({ error: 'Şifre güncellenemedi: ' + updateError.message }, { status: 500 })
  }

  // Audit log — şifre asla loglanmaz, sadece olayın kendisi
  try {
    const { staff } = await resolveActiveStaffForApi(supabase, user.id, 'id, name, business_id')
    if (staff) {
      await logAuditServer({
        businessId: staff.business_id,
        staffId: staff.id,
        staffName: staff.name ?? null,
        action: 'update',
        resource: 'staff',
        resourceId: staff.id,
        details: { event: 'password_changed_by_self' },
      })
    }
  } catch { /* audit hatası ana akışı durdurmasın */ }

  return NextResponse.json({ ok: true })
}
