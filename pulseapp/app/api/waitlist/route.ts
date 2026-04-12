import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logAuditServer } from '@/lib/utils/audit'

async function getStaffInfo(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  return staff
}

// GET — Bekleme listesi
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const url = request.nextUrl
  const activeOnly = url.searchParams.get('active') !== 'false'

  let query = supabase
    .from('waitlist_entries')
    .select('*, services(name), staff_members:staff_id(name), customers:customer_id(name, phone, segment)')
    .eq('business_id', staff.business_id)
    .order('created_at', { ascending: false })

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ entries: data || [] })
}

// POST — Yeni bekleme listesi kaydı
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { customerName, customerPhone, customerId, serviceId, staffId, preferredDate, preferredTimeStart, preferredTimeEnd, notes } = body

  if (!customerName || !customerPhone) {
    return NextResponse.json({ error: 'İsim ve telefon zorunludur' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('waitlist_entries')
    .insert({
      business_id: staff.business_id,
      customer_id: customerId || null,
      customer_name: customerName,
      customer_phone: customerPhone,
      service_id: serviceId || null,
      staff_id: staffId || null,
      preferred_date: preferredDate || null,
      preferred_time_start: preferredTimeStart || null,
      preferred_time_end: preferredTimeEnd || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'create',
    resource: 'waitlist',
    resourceId: data.id,
    details: { name: customerName, phone: customerPhone, service_id: serviceId || null },
  })

  return NextResponse.json({ entry: data })
}

// PATCH — Kaydı güncelle (deaktif et, bildirim gönderildi işaretle)
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body

  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const allowed: Record<string, any> = {}
  if (typeof updates.is_active === 'boolean') allowed.is_active = updates.is_active
  if (typeof updates.is_notified === 'boolean') allowed.is_notified = updates.is_notified

  const { error } = await supabase
    .from('waitlist_entries')
    .update(allowed)
    .eq('id', id)
    .eq('business_id', staff.business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (updates.is_active === false) {
    await logAuditServer({
      businessId: staff.business_id,
      staffId: staff.id,
      staffName: staff.name,
      action: 'delete',
      resource: 'waitlist',
      resourceId: id,
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — Kaydı sil
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const url = request.nextUrl
  const id = url.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const { error } = await supabase
    .from('waitlist_entries')
    .delete()
    .eq('id', id)
    .eq('business_id', staff.business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'delete',
    resource: 'waitlist',
    resourceId: id,
  })

  return NextResponse.json({ ok: true })
}
