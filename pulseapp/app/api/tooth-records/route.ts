import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission, requireWritePermission } from '@/lib/api/with-permission'

// GET: Hastanın tüm diş kayıtları
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'customers')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerId = searchParams.get('customerId')
  if (!businessId || !customerId) {
    return NextResponse.json({ error: 'businessId ve customerId gerekli' }, { status: 400 })
  }
  if (businessId !== auth.ctx.businessId) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  // RLS: tooth_records_business_isolation — business_id IN staff_members WHERE user_id = auth.uid()
  const supabase = createServerSupabaseClient()
  const { data, error } = await supabase
    .from('tooth_records')
    .select('*, staff:treated_by_staff_id(id, name)')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('tooth_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ records: data ?? [] })
}

// POST/PATCH: Diş kaydı oluştur veya güncelle (upsert by tooth_number)
export async function POST(request: NextRequest) {
  const auth = await requireWritePermission(request, 'customers')
  if (!auth.ok) return auth.response

  const body = await request.json()
  const { businessId, customerId, toothNumber, condition, treatment, notes, treatedAt } = body

  if (!businessId || !customerId || !toothNumber || !condition) {
    return NextResponse.json({ error: 'businessId, customerId, toothNumber ve condition gerekli' }, { status: 400 })
  }
  if (businessId !== auth.ctx.businessId) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  // RLS: tooth_records_business_isolation — business_id match zorunlu
  const supabase = createServerSupabaseClient()
  const payload = {
    business_id: businessId,
    customer_id: customerId,
    tooth_number: toothNumber,
    condition,
    treatment: treatment || null,
    notes: notes || null,
    treated_at: treatedAt || null,
    treated_by_staff_id: auth.ctx.staffId,
  }

  const { data, error } = await supabase
    .from('tooth_records')
    .upsert(payload, { onConflict: 'business_id,customer_id,tooth_number' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ record: data })
}

// DELETE: Diş kaydını sil (sadece tooth_number bazlı)
export async function DELETE(request: NextRequest) {
  const auth = await requireWritePermission(request, 'customers')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerId = searchParams.get('customerId')
  const toothNumber = searchParams.get('toothNumber')

  if (!businessId || !customerId || !toothNumber) {
    return NextResponse.json({ error: 'businessId, customerId ve toothNumber gerekli' }, { status: 400 })
  }
  if (businessId !== auth.ctx.businessId) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })
  }

  // RLS: tooth_records_business_isolation — business_id match zorunlu
  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('tooth_records')
    .delete()
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('tooth_number', parseInt(toothNumber))

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
