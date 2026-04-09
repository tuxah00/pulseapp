import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rooms: data })
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await req.json()
  const { name, capacity, color } = body

  if (!name?.trim()) return NextResponse.json({ error: 'name zorunlu' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('rooms')
    .insert({ business_id: businessId, name: name.trim(), capacity: capacity || 1, color: color || '#6366f1' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room: data }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 })

  const body = await req.json()
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('rooms')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ room: data })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id zorunlu' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  // Soft delete
  const { error } = await supabase
    .from('rooms')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
