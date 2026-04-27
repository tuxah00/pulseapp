import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { logAuditServer } from '@/lib/utils/audit'
import { expireStaleWaitlistHolds } from '@/lib/waitlist/cleanup'

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

  // Lazy cleanup — süresi dolan hold'ları pasifleştir (15dk hold'da cevap
  // vermeyen müşteriler slotu kaybetmiş sayılır, listeden düşer)
  await expireStaleWaitlistHolds(supabase, staff.business_id)

  let query = supabase
    .from('waitlist_entries')
    .select('*, services(name), staff_members:staff_id(name), customers:customer_id(name, phone, segment)')
    .eq('business_id', staff.business_id)
    .order('created_at', { ascending: true })

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
  const { customerName, customerPhone, customerId, serviceId, staffId, preferredDate, preferredTimeStart, preferredTimeEnd, notes, autoBookOnMatch } = body

  if (!customerName || !customerPhone) {
    return NextResponse.json({ error: 'İsim ve telefon zorunludur' }, { status: 400 })
  }

  // En az bir tercih kriteri zorunlu — hepsi NULL olursa müşteri her boşluğa eşleşir
  // ve hedefsiz bildirim alır. Hizmet, personel, tarih veya saatten en az biri seçilmeli.
  const hasCriterion = !!(serviceId || staffId || preferredDate || preferredTimeStart)
  if (!hasCriterion) {
    return NextResponse.json({
      error: 'Hizmet, personel, tarih veya saat tercihlerinden en az birini seçmelisin.'
    }, { status: 400 })
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
      auto_book_on_match: !!autoBookOnMatch,
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
    details: { customer_name: customerName, phone: customerPhone, service_id: serviceId || null },
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
    const { data: entryAudit } = await supabase
      .from('waitlist_entries')
      .select('customer_name, customer_phone, services(name)')
      .eq('id', id)
      .eq('business_id', staff.business_id)
      .maybeSingle()
    const rawSvcAudit = entryAudit?.services
    const svcAudit = (Array.isArray(rawSvcAudit) ? rawSvcAudit[0] : rawSvcAudit) as { name: string } | null
    await logAuditServer({
      businessId: staff.business_id,
      staffId: staff.id,
      staffName: staff.name,
      action: 'delete',
      resource: 'waitlist',
      resourceId: id,
      details: {
        customer_name: entryAudit?.customer_name || null,
        service_name: svcAudit?.name || null,
      },
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

  // Silmeden önce detayları al (audit log için)
  const { data: delEntry } = await supabase
    .from('waitlist_entries')
    .select('customer_name, customer_phone, services(name)')
    .eq('id', id)
    .eq('business_id', staff.business_id)
    .maybeSingle()

  const { error } = await supabase
    .from('waitlist_entries')
    .delete()
    .eq('id', id)
    .eq('business_id', staff.business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rawDelSvc = delEntry?.services
  const delSvc = (Array.isArray(rawDelSvc) ? rawDelSvc[0] : rawDelSvc) as { name: string } | null
  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'delete',
    resource: 'waitlist',
    resourceId: id,
    details: {
      customer_name: delEntry?.customer_name || null,
      service_name: delSvc?.name || null,
    },
  })

  return NextResponse.json({ ok: true })
}
