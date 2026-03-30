import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET /api/packages?businessId=...&type=templates|customer&customerId=...&status=...
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const type = searchParams.get('type') ?? 'templates' // 'templates' | 'customer'
  const customerId = searchParams.get('customerId')
  const status = searchParams.get('status')
  const search = searchParams.get('search') ?? ''

  if (!businessId) return NextResponse.json({ error: 'businessId required' }, { status: 400 })

  if (type === 'templates') {
    // Paket şablonları (service_packages)
    const { data, error } = await supabase
      .from('service_packages')
      .select('*, service:services(name, duration_minutes)')
      .eq('business_id', businessId)
      .order('sort_order')
      .order('created_at')

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ packages: data })
  }

  // Müşteri paketleri (customer_packages)
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

// POST /api/packages — paket şablonu veya müşteri paketi oluştur
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'templates'
  const body = await req.json()

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'

  const { data, error } = await supabase
    .from(table)
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data })
}

// PATCH /api/packages?id=...&type=...
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') ?? 'templates'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'
  const body = await req.json()

  const { data, error } = await supabase
    .from(table)
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ package: data })
}

// DELETE /api/packages?id=...&type=...
export async function DELETE(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const type = searchParams.get('type') ?? 'templates'
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'

  const { error } = await supabase.from(table).delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
