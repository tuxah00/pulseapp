import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { allergyCreateSchema } from '@/lib/schemas'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// GET: Müşteri alerjileri
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const customerId = searchParams.get('customerId')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  let query = supabase
    .from('customer_allergies')
    .select('*')
    .eq('business_id', businessId)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ allergies: data })
}

// POST: Yeni alerji ekle
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const result = await validateBody(request, allergyCreateSchema)
  if (!result.ok) return result.response
  const { businessId, customerId, allergen, severity, reaction, notes } = result.data

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { data, error } = await supabase
    .from('customer_allergies')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      allergen,
      severity: severity || 'moderate',
      reaction: reaction || null,
      notes: notes || null,
      created_by: staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ allergy: data }, { status: 201 })
}

// DELETE: Alerji sil
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const id = searchParams.get('id')

  if (!businessId || !id) return NextResponse.json({ error: 'businessId ve id gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { error } = await supabase
    .from('customer_allergies')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
