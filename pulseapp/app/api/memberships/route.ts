import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'
import { validateBody, parsePaginationParams } from '@/lib/api/validate'
import { membershipCreateSchema, membershipPatchSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'memberships')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search') || ''
  const { page, pageSize, from, to } = parsePaginationParams(searchParams)

  let query = supabase
    .from('memberships')
    .select('*', { count: 'exact' })
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (search) query = query.ilike('customer_name', `%${search}%`)

  const { data, count, error } = await query.range(from, to)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ memberships: data, total: count || 0 })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'memberships')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const result = await validateBody(req, membershipCreateSchema)
  if (!result.ok) return result.response

  const supabase = createServerSupabaseClient()
  // business_id her zaman auth'tan
  const payload = { ...result.data, business_id: businessId }

  const { data, error } = await supabase
    .from('memberships')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ membership: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'memberships')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const result = await validateBody(req, membershipPatchSchema)
  if (!result.ok) return result.response

  const supabase = createServerSupabaseClient()
  const payload = { ...result.data } as Record<string, unknown>
  delete payload.business_id

  const { data, error } = await supabase
    .from('memberships')
    .update(payload)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ membership: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'memberships')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('memberships')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
