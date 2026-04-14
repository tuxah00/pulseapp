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

// Beyaz liste — mass assignment ve cross-tenant FK enjeksiyonunu engeller
const TEMPLATE_FIELDS = ['service_id', 'name', 'description', 'total_sessions', 'price', 'validity_days', 'is_active', 'sort_order'] as const
const CUSTOMER_FIELDS = ['customer_id', 'service_id', 'package_id', 'customer_name', 'total_sessions', 'used_sessions', 'price', 'status', 'expires_at', 'notes'] as const

function pick<T extends readonly string[]>(body: Record<string, unknown>, fields: T): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const k of fields) if (body[k] !== undefined) out[k] = body[k]
  return out
}

async function verifyOwnership(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  table: 'customers' | 'services',
  id: unknown,
  businessId: string,
): Promise<boolean> {
  if (typeof id !== 'string') return false
  const { data } = await supabase.from(table).select('id').eq('id', id).eq('business_id', businessId).maybeSingle()
  return !!data
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'packages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const { searchParams } = new URL(req.url)
  const type = searchParams.get('type') ?? 'templates'
  const body = await req.json() as Record<string, unknown>

  const table = type === 'templates' ? 'service_packages' : 'customer_packages'
  const picked = pick(body, type === 'templates' ? TEMPLATE_FIELDS : CUSTOMER_FIELDS)
  const payload: Record<string, unknown> = { ...picked, business_id: businessId }

  // FK'ler bu işletmeye ait olmalı
  if (payload.customer_id && !(await verifyOwnership(supabase, 'customers', payload.customer_id, businessId))) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
  }
  if (payload.service_id && !(await verifyOwnership(supabase, 'services', payload.service_id, businessId))) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

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
  const body = await req.json() as Record<string, unknown>
  const updates = pick(body, type === 'templates' ? TEMPLATE_FIELDS : CUSTOMER_FIELDS)

  // FK değişikliğinde cross-tenant doğrulaması
  if (updates.customer_id && !(await verifyOwnership(supabase, 'customers', updates.customer_id, businessId))) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
  }
  if (updates.service_id && !(await verifyOwnership(supabase, 'services', updates.service_id, businessId))) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from(table)
    .update(updates)
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
