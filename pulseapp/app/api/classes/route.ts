import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('classes')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('start_time', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ classes: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const body = await req.json()
  // business_id her zaman auth'tan — client override edemez
  const payload = { ...body, business_id: businessId }

  const { data, error } = await supabase
    .from('classes')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ class: data })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  // business_id değiştirilemez (tenant boundary)
  delete body.business_id

  const { data, error } = await supabase
    .from('classes')
    .update(body)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ class: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'classes')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
