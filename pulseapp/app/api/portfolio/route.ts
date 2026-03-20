import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const category = searchParams.get('category')

  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  let query = supabase
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
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('portfolio_items')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const body = await req.json()
  const { data, error } = await supabase
    .from('portfolio_items')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Get storage_path before deleting
  const { data: item } = await supabase.from('portfolio_items').select('storage_path').eq('id', id).single()

  const { error } = await supabase.from('portfolio_items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also delete from storage if path exists
  if (item?.storage_path) {
    await supabase.storage.from('portfolio').remove([item.storage_path])
  }

  return NextResponse.json({ success: true })
}
