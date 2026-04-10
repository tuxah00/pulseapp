import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditServer } from '@/lib/utils/audit'

// POST: Create invitation
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff || staff.role !== 'owner') {
    return NextResponse.json({ error: 'Sadece işletme sahibi davet oluşturabilir' }, { status: 403 })
  }

  const { email, role = 'staff' } = await req.json()

  const { data: invitation, error } = await supabase
    .from('staff_invitations')
    .insert({
      business_id: staff.business_id,
      invited_by: staff.id,
      email: email || null,
      role,
    })
    .select('token')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'create',
    resource: 'staff_invitation',
    details: { email: email || null, role },
  })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://pulseapp.vercel.app'
  return NextResponse.json({
    token: invitation.token,
    link: `${appUrl}/invite/${invitation.token}`,
  })
}

// GET: Validate token (public — must use admin client to bypass RLS)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token gerekli' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('staff_invitations')
    .select('id, business_id, role, email, expires_at, used_at, businesses(name)')
    .eq('token', token)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Geçersiz davet linki' }, { status: 404 })
  if (data.used_at) return NextResponse.json({ error: 'Bu davet linki daha önce kullanıldı' }, { status: 410 })
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ error: 'Davet linki süresi dolmuş' }, { status: 410 })

  return NextResponse.json({ invitation: data })
}
