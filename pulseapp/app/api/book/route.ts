import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    .select('id, name, sector, working_hours, phone, address, city, district, settings')
    .eq('id', businessId)
    .eq('is_active', true)
    .single()

  if (bizErr || !business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const { data: services } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('sort_order')

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('is_active', true)

  return NextResponse.json({
    business,
    services: services || [],
    staff: staff || [],
  })
}

export async function POST(req: NextRequest) {
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId) {
    return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const body = await req.json()

  const {
    service_id,
    staff_id,
    appointment_date,
    start_time,
    customer_name,
    customer_phone,
  } = body

  if (!service_id || !appointment_date || !start_time || !customer_name || !customer_phone) {
    return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 })
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .eq('is_active', true)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes, name')
    .eq('id', service_id)
    .eq('business_id', businessId)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

  const [h, m] = start_time.split(':').map(Number)
  const totalMin = h * 60 + m + service.duration_minutes
  const endH = Math.floor(totalMin / 60)
  const endM = totalMin % 60
  const end_time = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`

  let conflictQuery = supabase
    .from('appointments')
    .select('id')
    .eq('business_id', businessId)
    .eq('appointment_date', appointment_date)
    .in('status', ['pending', 'confirmed'])
    .lt('start_time', end_time)
    .gt('end_time', start_time)

  if (staff_id) {
    conflictQuery = conflictQuery.eq('staff_id', staff_id)
  }

  const { data: conflicts } = await conflictQuery

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: 'Bu saat dolu. Lütfen başka bir saat seçin.' }, { status: 409 })
  }

  const normalizedPhone = customer_phone.replace(/\s/g, '')
  let customerId: string

  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', businessId)
    .eq('phone', normalizedPhone)
    .single()

  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { data: newCustomer, error: custErr } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        name: customer_name,
        phone: normalizedPhone,
        segment: 'new',
        total_visits: 0,
        total_revenue: 0,
        total_no_shows: 0,
        whatsapp_opted_in: false,
        is_active: true,
      })
      .select('id')
      .single()

    if (custErr || !newCustomer) {
      return NextResponse.json({ error: 'Müşteri oluşturulamadı' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  const { data: appointment, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      service_id,
      staff_id: staff_id || null,
      appointment_date,
      start_time,
      end_time,
      status: 'pending',
      source: 'web',
      reminder_24h_sent: false,
      reminder_2h_sent: false,
      review_requested: false,
    })
    .select('id')
    .single()

  if (apptErr) {
    return NextResponse.json({ error: 'Randevu oluşturulamadı' }, { status: 500 })
  }

  // Online randevu bildirimi oluştur
  try {
    await supabase.from('notifications').insert({
      business_id: businessId,
      type: 'appointment',
      title: 'Yeni Online Randevu',
      message: `${customer_name} – ${service.name} – ${start_time}`,
      data: { appointment_id: appointment.id },
      is_read: false,
    })
  } catch { /* bildirim hatası randevu oluşturmayı etkilemez */ }

  return NextResponse.json({ success: true, appointment_id: appointment.id })
}
