import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'portfolio')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')

  const admin = createAdminClient()
  let query = admin
    .from('portfolio_items')
    .select('*')
    .eq('business_id', businessId)
    .order('is_featured', { ascending: false })
    .order('created_at', { ascending: false })

  if (category && category !== 'all') query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ items: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'portfolio')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('portfolio_items')
    .insert({ ...body, business_id: businessId })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'portfolio')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()

  const { data, error } = await admin
    .from('portfolio_items')
    .update(body)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'portfolio')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()

  // Get storage_path before deleting
  const { data: item } = await admin
    .from('portfolio_items')
    .select('storage_path')
    .eq('id', id)
    .eq('business_id', businessId)
    .single()

  const { error } = await admin
    .from('portfolio_items')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also delete from storage if path exists
  if (item?.storage_path) {
    await admin.storage.from('portfolio').remove([item.storage_path])
  }

  return NextResponse.json({ success: true })
}
