import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, toE164Phone } from '@/lib/utils/phone'

export interface CreateBookingInput {
  businessId: string
  name: string
  phone: string
  serviceId: string
  /** Belirtilmezse staff_id null olarak kaydedilir */
  staffId?: string | null
  date: string        // YYYY-MM-DD
  startTime: string   // HH:MM
  notes?: string | null
  source?: 'web' | 'dashboard' | 'portal'
  withManageToken?: boolean
  /**
   * Çağıran route zaten services sorgusunu yapmışsa duration'ı buradan geçirebilir;
   * iletilirse createBooking içinde services tekrar sorgulanmaz.
   */
  durationMinutes?: number
}

export interface CreateBookingResult {
  appointmentId: string
  customerId: string
  endTime: string
  manageToken?: string
  service: { name: string; price: number }
}

/**
 * Ortak randevu oluşturma çekirdeği.
 * Hem public booking endpoint'i hem legacy booking endpoint'i kullanır.
 * Sorumluluk: end-time hesabı, conflict kontrolü, müşteri upsert, randevu insert, bildirim.
 * Sorumluluk değil: working-hours kontrolü, auto-staff assign, SMS — bunlar çağıran route'ta kalır.
 */
export async function createBooking(
  supabase: SupabaseClient,
  input: CreateBookingInput,
): Promise<CreateBookingResult> {
  const {
    businessId, name, phone, serviceId, staffId,
    date, startTime, notes, source = 'web', withManageToken = false,
    durationMinutes: providedDuration,
  } = input

  // Hizmet — `durationMinutes` dışarıdan sağlanmışsa sorguyu atla
  let serviceName = ''
  let servicePrice = 0
  let duration = providedDuration ?? 0

  if (providedDuration === undefined) {
    const { data: service } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .single()

    if (!service) throw Object.assign(new Error('Hizmet bulunamadı'), { status: 404 })
    serviceName = service.name
    servicePrice = service.price
    duration = service.duration_minutes
  } else {
    // duration dışarıdan geldi; isim+fiyat için minimal sorgu
    const { data: service } = await supabase
      .from('services')
      .select('name, price')
      .eq('id', serviceId)
      .eq('business_id', businessId)
      .single()

    if (!service) throw Object.assign(new Error('Hizmet bulunamadı'), { status: 404 })
    serviceName = service.name
    servicePrice = service.price
  }

  // Bitiş saati
  const [sh, sm] = startTime.split(':').map(Number)
  const endTotal = sh * 60 + sm + duration
  if (endTotal >= 24 * 60) throw Object.assign(new Error('Randevu gece yarısını aşamaz'), { status: 400 })
  const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

  // Çakışma kontrolü
  let q = supabase
    .from('appointments')
    .select('id')
    .eq('business_id', businessId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
  if (staffId) q = q.eq('staff_id', staffId)

  const { data: conflicts } = await q
  if (conflicts?.length) throw Object.assign(new Error('Bu saat dolu. Lütfen başka bir saat seçin.'), { status: 409 })

  // Müşteri upsert — E.164 formatında sakla, TOCTOU yarışını önle
  // uq_customers_business_phone unique index ile eşzamanlı insert'leri engeller
  const normalizedPhone = toE164Phone(normalizePhone(phone))
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .upsert(
      {
        business_id: businessId,
        name: name.trim(),
        phone: normalizedPhone,
        segment: 'new',
        total_visits: 0,
        total_revenue: 0,
        total_no_shows: 0,
        is_active: true,
      },
      { onConflict: 'business_id,phone', ignoreDuplicates: false }
    )
    .select('id')
    .single()
  if (custErr || !customer) throw Object.assign(new Error('Müşteri oluşturulamadı'), { status: 500 })
  const customerId = customer.id

  // Randevu insert
  const apptData: Record<string, unknown> = {
    business_id: businessId,
    customer_id: customerId,
    service_id: serviceId,
    appointment_date: date,
    start_time: startTime,
    end_time: endTime,
    status: 'pending',
    source,
    notes: notes ?? null,
    reminder_24h_sent: false,
    reminder_2h_sent: false,
    review_requested: false,
  }
  if (staffId) apptData.staff_id = staffId
  if (withManageToken) {
    apptData.manage_token = crypto.randomUUID()
    apptData.token_expires_at = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  }

  const { data: appt, error: apptErr } = await supabase
    .from('appointments')
    .insert(apptData)
    .select('id, manage_token')
    .single()
  if (apptErr || !appt) throw Object.assign(new Error('Randevu oluşturulamadı'), { status: 500 })

  // Bildirim — await ile bekle; fire-and-forget olursa Vercel handler kapanmadan önce kaybolabilir
  await supabase.from('notifications').insert({
    business_id: businessId,
    type: 'appointment',
    title: 'Yeni Online Randevu',
    message: `${name.trim()} — ${serviceName} — ${date} ${startTime}`,
    related_id: appt.id,
    related_type: 'appointment',
    is_read: false,
  }).then(() => undefined, () => undefined)

  return {
    appointmentId: appt.id,
    customerId,
    endTime,
    manageToken: appt.manage_token ?? undefined,
    service: { name: serviceName, price: servicePrice },
  }
}
