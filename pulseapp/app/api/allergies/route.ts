import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logAuditServer } from '@/lib/utils/audit'

async function getStaffInfo(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
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

  const staff = await getStaffInfo(supabase, user.id, businessId)
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

  const body = await request.json()
  const { businessId, customerId, allergen, severity, reaction, notes } = body

  if (!businessId || !customerId || !allergen) {
    return NextResponse.json({ error: 'businessId, customerId, allergen zorunlu' }, { status: 400 })
  }

  const staff = await getStaffInfo(supabase, user.id, businessId)
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

  await logAuditServer({
    businessId,
    staffId: staff?.id || null,
    staffName: staff?.name || null,
    action: 'create',
    resource: 'allergy',
    resourceId: data.id,
    details: { allergen, severity: severity || 'moderate' },
  })

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

  const staff = await getStaffInfo(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  // Silmeden önce bilgiyi al (audit için)
  const { data: allergyData } = await supabase
    .from('customer_allergies')
    .select('allergen, severity')
    .eq('id', id)
    .single()

  const { error } = await supabase
    .from('customer_allergies')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId,
    staffId: staff?.id || null,
    staffName: staff?.name || null,
    action: 'delete',
    resource: 'allergy',
    resourceId: id,
    details: { allergen: allergyData?.allergen || null, severity: allergyData?.severity || null },
  })

  return NextResponse.json({ success: true })
}
