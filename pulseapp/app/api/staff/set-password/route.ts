import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'

/**
 * POST /api/staff/set-password
 *
 * İşletme sahibi tarafından personelin şifresini doğrudan sıfırlar (Supabase
 * Admin API: auth.admin.updateUserById).
 *
 * Niye `generateLink` (recovery flow) yerine doğrudan set?
 *   - Recovery linki Supabase Site URL'e bağlı → yanlış ayarlanmışsa 3. parti
 *     site'a redirect riski (URL hash'inde access_token uçuşur).
 *   - Doğrudan set: link yok → redirect/allowlist sorunu yok, token sızıntısı yok.
 *
 * Body:
 *   { staffId: string, password?: string }
 *   - password verilmezse 10 karakter güvenli rastgele üretir.
 *
 * Response:
 *   { password: string, staffName: string }
 *   - Yeni şifre tek seferlik gösterilmek üzere döner; owner personeline iletir.
 */

// Yaygın karıştırılan karakterler (0/O, 1/l/I) çıkarıldı — owner manuel okumayı kolaylaştırır
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

function generateRandomPassword(length = 10): string {
  // crypto.getRandomValues — Node 18+ Web Crypto API
  const arr = new Uint32Array(length)
  crypto.getRandomValues(arr)
  let out = ''
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[arr[i] % PASSWORD_CHARS.length]
  }
  return out
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { staff } = await resolveActiveStaffForApi(supabase, user.id, 'id, name, business_id, role, is_active')
  if (!staff || staff.role !== 'owner') {
    return NextResponse.json({ error: 'Sadece işletme sahibi şifre sıfırlayabilir' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const { staffId, password: customPassword } = body as { staffId?: string; password?: string }

  if (!staffId) return NextResponse.json({ error: 'staffId gerekli' }, { status: 400 })
  if (customPassword !== undefined && (typeof customPassword !== 'string' || customPassword.length < 6)) {
    return NextResponse.json({ error: 'Şifre en az 6 karakter olmalı' }, { status: 400 })
  }

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

  if (targetStaff.role === 'owner') {
    return NextResponse.json(
      { error: 'İşletme sahibine bu yöntemle şifre belirlenemez' },
      { status: 403 }
    )
  }

  const newPassword = customPassword ?? generateRandomPassword(10)

  // Supabase Admin — şifreyi doğrudan set et
  const { error: updateErr } = await admin.auth.admin.updateUserById(
    targetStaff.user_id,
    { password: newPassword }
  )

  if (updateErr) {
    return NextResponse.json(
      { error: 'Şifre güncellenemedi: ' + updateErr.message },
      { status: 500 }
    )
  }

  // Audit log — yeni şifre asla loglanmaz, sadece olayın kendisi
  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'update',
    resource: 'staff',
    resourceId: targetStaff.id,
    details: {
      event: 'password_reset_by_owner',
      target_staff_name: targetStaff.name ?? null,
    },
  })

  return NextResponse.json({
    password: newPassword,
    staffName: targetStaff.name,
  })
}
