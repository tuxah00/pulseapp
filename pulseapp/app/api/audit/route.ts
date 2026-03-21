import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!staff || staff.role !== 'owner') {
    return NextResponse.json({ error: 'Sadece işletme sahibi erişebilir' }, { status: 403 })
  }

  const admin = createAdminClient()
  const limit = parseInt(req.nextUrl.searchParams.get('limit') ?? '50')
  const offset = parseInt(req.nextUrl.searchParams.get('offset') ?? '0')
  const resource = req.nextUrl.searchParams.get('resource')
  const staffFilter = req.nextUrl.searchParams.get('staff_id')

  let query = admin
    .from('audit_logs')
    .select('*', { count: 'exact' })
    .eq('business_id', staff.business_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (resource) query = query.eq('resource', resource)
  if (staffFilter) query = query.eq('staff_id', staffFilter)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ logs: data ?? [], total: count ?? 0 })
}

export async function POST(req: NextRequest) {
  const admin = createAdminClient()
  const body = await req.json()

  // IP adresini al
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || req.headers.get('x-real-ip')
    || null

  const { data, error } = await admin.from('audit_logs').insert({
    business_id: body.businessId,
    staff_id: body.staffId || null,
    staff_name: body.staffName || null,
    action: body.action,
    resource: body.resource,
    resource_id: body.resourceId || null,
    details: body.details || null,
    ip_address: ip,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ log: data })
}
