import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'

// GET /api/packages?type=templates|customer&customerId=...&status=...
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'packages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'templates'
  const customerId = searchParams.get('customerId')
  const status = searchParams.get('status')
  const search = searchParams.get('search') ?? ''

  if (type === 'templates') {
    const { data, error } = await supabase
      .from('service_packages')
      .select('*, service:services(name, duration_minutes)')
      .eq('business_id', businessId)
      .order('sort_order')
      .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ packages: data })
  }

  let query = supabase
    .from('customer_packages')
    .select('*, customer:customers(name, phone), service:services(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (customerId) query = query.eq('customer_id', customerId)
  if (search) query = query.ilike('customer_name', `%${search}%`)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ packages: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'packages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'templates'
  const body = await req.json()

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'
  const payload = { ...body, business_id: businessId }

  const { data, error } = await supabase
    .from(table)
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'packages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') ?? 'templates'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'
  const body = await req.json()
  delete body.business_id

  const { data, error } = await supabase
    .from(table)
    .update(body)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'packages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') ?? 'templates'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'

  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
