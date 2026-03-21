import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const { token, user_id, name } = await req.json()
  if (!token || !user_id || !name) {
    return NextResponse.json({ error: 'Eksik bilgi' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Validate invitation
  const { data: invitation, error: invErr } = await admin
    .from('staff_invitations')
    .select('id, business_id, role, email, expires_at, used_at')
    .eq('token', token)
    .single()

  if (invErr || !invitation) return NextResponse.json({ error: 'Geçersiz token' }, { status: 404 })
  if (invitation.used_at) return NextResponse.json({ error: 'Bu davet zaten kullanıldı' }, { status: 410 })
  if (new Date(invitation.expires_at) < new Date()) return NextResponse.json({ error: 'Davet süresi dolmuş' }, { status: 410 })

  // Create staff_member record
  const { error: staffErr } = await admin.from('staff_members').insert({
    business_id: invitation.business_id,
    user_id,
    name,
    role: invitation.role,
    is_active: true,
    permissions: null, // Use role defaults
  })

  if (staffErr) return NextResponse.json({ error: 'Personel kaydı oluşturulamadı: ' + staffErr.message }, { status: 500 })

  // Mark invitation as used
  await admin.from('staff_invitations').update({ used_at: new Date().toISOString() }).eq('id', invitation.id)

  return NextResponse.json({ success: true })
}
