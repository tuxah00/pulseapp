import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('90') && digits.length === 12) return `+${digits}`
  if (digits.startsWith('0') && digits.length === 11) return `+90${digits.slice(1)}`
  if (digits.length === 10) return `+90${digits}`
  return `+${digits}`
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const body = await req.json()
  const { name, phone, serviceId, staffId, date, startTime, notes } = body

  if (!name || !phone || !serviceId || !date || !startTime) {
    return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 })
  }

  // Servis bilgisi (süre için)
  const { data: service } = await supabase
    .from('services')
    .select('id, name, duration_minutes, price')
    .eq('id', serviceId)
    .eq('business_id', params.id)
    .single()

  if (!service) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

  // End time hesapla
  const [sh, sm] = startTime.split(':').map(Number)
  const endTotal = sh * 60 + sm + service.duration_minutes
  const endTime = `${Math.floor(endTotal / 60).toString().padStart(2, '0')}:${(endTotal % 60).toString().padStart(2, '0')}`

  const normalizedPhone = normalizePhone(phone)

  // Müşteriyi bul veya oluştur
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', params.id)
    .eq('phone', normalizedPhone)
    .single()

  let customerId: string

  if (existingCustomer) {
    customerId = existingCustomer.id
  } else {
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        business_id: params.id,
        name: name.trim(),
        phone: normalizedPhone,
        segment: 'new',
        total_visits: 0,
        total_revenue: 0,
        total_no_shows: 0,
        is_active: true,
      })
      .select('id')
      .single()

    if (customerError || !newCustomer) {
      return NextResponse.json({ error: 'Müşteri oluşturulamadı' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // Randevu oluştur
  const appointmentData: Record<string, unknown> = {
    business_id: params.id,
    customer_id: customerId,
    service_id: serviceId,
    appointment_date: date,
    start_time: startTime,
    end_time: endTime,
    status: 'pending',
    source: 'web',
    notes: notes || null,
    reminder_24h_sent: false,
    reminder_2h_sent: false,
    review_requested: false,
  }

  if (staffId) appointmentData.staff_id = staffId

  const { data: appointment, error: apptError } = await supabase
    .from('appointments')
    .insert(appointmentData)
    .select('id')
    .single()

  if (apptError || !appointment) {
    return NextResponse.json({ error: 'Randevu oluşturulamadı' }, { status: 500 })
  }

  // Dashboard bildirimi
  await supabase.from('notifications').insert({
    business_id: params.id,
    type: 'appointment',
    title: 'Yeni Online Randevu',
    message: `${name} — ${service.name} — ${date} ${startTime}`,
    is_read: false,
  })

  return NextResponse.json({
    success: true,
    appointmentId: appointment.id,
    message: 'Randevunuz başarıyla oluşturuldu!',
    details: {
      service: service.name,
      date,
      startTime,
      endTime,
    }
  })
}
