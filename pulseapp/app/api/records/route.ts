import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type')
  const search = searchParams.get('search') || ''

  if (!type) {
    return NextResponse.json({ error: 'type is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
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
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await req.json()
  const { type, title, data, customer_id } = body

  if (!type || !title) {
    return NextResponse.json({ error: 'type and title are required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: record, error } = await admin
    .from('business_records')
    .insert({ business_id: businessId, type, title, data: data || {}, customer_id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record })
}

export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const body = await req.json()
  const updateObj: Record<string, unknown> = {}

  if (body.title !== undefined) updateObj.title = body.title
  if (body.customer_id !== undefined) updateObj.customer_id = body.customer_id
  if (body.data !== undefined) updateObj.data = body.data

  const admin = createAdminClient()

  // file_urls: mevcut dosyalara ekle (merge)
  if (body.file_urls && Array.isArray(body.file_urls)) {
    const { data: existing } = await admin
      .from('business_records')
      .select('data')
      .eq('id', id)
      .eq('business_id', businessId)
      .single()
    const existingData = (existing?.data as Record<string, unknown>) || {}
    const existingFileUrls: string[] = (existingData.file_urls as string[]) || []
    updateObj.data = {
      ...existingData,
      ...(updateObj.data as Record<string, unknown> || {}),
      file_urls: [...existingFileUrls, ...body.file_urls],
    }
  }

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const { data: record, error } = await admin
    .from('business_records')
    .update(updateObj)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record })
}

export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('business_records')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
