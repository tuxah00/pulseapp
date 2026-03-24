import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const type = searchParams.get('type')
  const search = searchParams.get('search') || ''

  if (!businessId || !type) {
    return NextResponse.json({ error: 'businessId and type are required' }, { status: 400 })
  }

  let query = supabase
    .from('business_records')
    .select('*')
    .eq('business_id', businessId)
    .eq('type', type)
    .order('created_at', { ascending: false })

  if (search) {
    query = query.ilike('title', `%${search}%`)
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ records: data })
}

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const body = await req.json()
  const { business_id, type, title, data, customer_id } = body

  if (!business_id || !type || !title) {
    return NextResponse.json({ error: 'business_id, type, and title are required' }, { status: 400 })
  }

  const { data: record, error } = await supabase
    .from('business_records')
    .insert({ business_id, type, title, data: data || {}, customer_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record })
}

export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const body = await req.json()
  const updateObj: Record<string, any> = {}

  if (body.title !== undefined) updateObj.title = body.title
  if (body.customer_id !== undefined) updateObj.customer_id = body.customer_id
  if (body.data !== undefined) updateObj.data = body.data

  // file_urls: mevcut dosyalara ekle (merge)
  if (body.file_urls && Array.isArray(body.file_urls)) {
    const { data: existing } = await supabase
      .from('business_records')
      .select('data')
      .eq('id', id)
      .single()
    const existingData = (existing?.data as Record<string, any>) || {}
    const existingFileUrls: string[] = existingData.file_urls || []
    updateObj.data = {
      ...existingData,
      ...(updateObj.data || {}),
      file_urls: [...existingFileUrls, ...body.file_urls],
    }
  }

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: record, error } = await supabase
    .from('business_records')
    .update(updateObj)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record })
}

export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const { error } = await supabase
    .from('business_records')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
