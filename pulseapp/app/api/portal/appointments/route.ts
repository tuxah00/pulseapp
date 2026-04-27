import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalAppointmentCreateSchema } from '@/lib/schemas'
import { checkWorkingHours } from '@/lib/booking/working-hours'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/appointments' })

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const { searchParams } = new URL(request.url)
  const filter = searchParams.get('filter') || 'all'

  const admin = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  let query = admin
    .from('appointments')
    .select(`
      id, appointment_date, start_time, end_time, status, notes,
      customer_package_id, package_name, package_unit_price,
      services(id, name, price, duration_minutes),
      staff_members(id, name)
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)

  if (filter === 'upcoming') {
    query = query
      .gte('appointment_date', today)
      .in('status', ['pending', 'confirmed'])
      .order('appointment_date', { ascending: true })
      .order('start_time', { ascending: true })
  } else if (filter === 'past') {
    query = query
      .or(`appointment_date.lt.${today},status.in.(completed,cancelled,no_show)`)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(50)
  } else {
    query = query
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(100)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Randevular yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ appointments: data || [] })
}

/**
 * POST /api/portal/appointments
 *
 * Müşteri portal'dan online randevu oluşturur.
 *
 * Paket seansı akışı (packageId verilince):
 *   1. Paket doğrulanır (active, kalan seans > 0, müşteriye ait)
 *   2. Randevu oluşturulurken customer_package_id + package_name + package_unit_price atanır
 *   3. package_usages tablosuna rezervasyon kaydı girilir (used_at = randevu saati)
 *   4. sessions_used DEĞİŞMEZ — seans düşümü randevu tamamlanınca yapılır
 *   5. İptal olursa rezervasyon silinir, seans korunur
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalAppointmentCreateSchema)
  if (!parsed.ok) return parsed.response
  const { serviceId, staffId = null, date, startTime, notes = null, packageId = null } = parsed.data

  const admin = createAdminClient()

  // Paket varsa önceden doğrula (INSERT öncesi — fiyat bilgisi lazım)
  let linkedPkg: { id: string; package_name: string; price_paid: number; sessions_total: number; sessions_used: number } | null = null
  if (packageId) {
    const { data: fetchedPkg } = await admin
      .from('customer_packages')
      .select('id, package_name, price_paid, sessions_total, sessions_used')
      .eq('id', packageId)
      .eq('customer_id', customerId)
      .eq('business_id', businessId)
      .eq('status', 'active')
      .single()

    if (!fetchedPkg) {
      return NextResponse.json({ error: 'Geçerli aktif paket bulunamadı' }, { status: 400 })
    }
    if (fetchedPkg.sessions_used >= fetchedPkg.sessions_total) {
      return NextResponse.json({ error: 'Bu pakette kullanılabilir seans kalmadı' }, { status: 400 })
    }
    linkedPkg = fetchedPkg
  }

  // Bağımsız sorgular paralel çalışır
  const [
    { data: service, error: svcErr },
    { data: business },
    { data: customerForNotif },
  ] = await Promise.all([
    admin.from('services').select('id, name, duration_minutes, price').eq('id', serviceId).eq('business_id', businessId).single(),
    admin.from('businesses').select('working_hours').eq('id', businessId).single(),
    admin.from('customers').select('name').eq('id', customerId).single(),
  ])

  if (svcErr || !service) {
    return NextResponse.json({ error: 'Hizmet bulunamadı' }, { status: 404 })
  }

  const whError = checkWorkingHours(
    business?.working_hours as Parameters<typeof checkWorkingHours>[0],
    date,
    startTime,
  )
  if (whError) {
    return NextResponse.json({ error: whError.error }, { status: whError.status })
  }

  // Geçmiş tarih reddi
  const requested = new Date(`${date}T${startTime}:00`)
  if (requested.getTime() < Date.now()) {
    return NextResponse.json({ error: 'Geçmiş bir tarihe randevu oluşturulamaz' }, { status: 400 })
  }

  // Bitiş saati hesapla
  const [sh, sm] = startTime.split(':').map(Number)
  const endTotal = sh * 60 + sm + service.duration_minutes
  if (endTotal >= 24 * 60) {
    return NextResponse.json({ error: 'Randevu gece yarısını aşamaz' }, { status: 400 })
  }
  const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

  // Çakışma kontrolü
  let cq = admin
    .from('appointments')
    .select('id')
    .eq('business_id', businessId)
    .eq('appointment_date', date)
    .in('status', ['pending', 'confirmed'])
    .is('deleted_at', null)
    .lt('start_time', endTime)
    .gt('end_time', startTime)
  if (staffId) cq = cq.eq('staff_id', staffId)

  const { data: conflicts } = await cq
  if (conflicts?.length) {
    return NextResponse.json({ error: 'Bu saat dolu. Lütfen başka bir saat seçin.' }, { status: 409 })
  }

  // Randevu INSERT
  const apptData: Record<string, unknown> = {
    business_id: businessId,
    customer_id: customerId,
    service_id: serviceId,
    appointment_date: date,
    start_time: startTime,
    end_time: endTime,
    status: 'pending',
    notes: notes ?? null,
    reminder_24h_sent: false,
    reminder_2h_sent: false,
    review_requested: false,
  }
  if (staffId) apptData.staff_id = staffId

  // Paket bağlantısı — seans fiyatı hesapla ve randevuya kaydet
  if (linkedPkg) {
    apptData.customer_package_id = linkedPkg.id
    apptData.package_name = linkedPkg.package_name
    // Paket birim fiyatı: ödenen toplam / toplam seans (1 seans ne kadara denk geliyor)
    apptData.package_unit_price = linkedPkg.sessions_total > 0
      ? Math.round((linkedPkg.price_paid / linkedPkg.sessions_total) * 100) / 100
      : 0
  }

  const { data: appt, error: apptErr } = await admin
    .from('appointments')
    .insert(apptData)
    .select('id')
    .single()

  if (apptErr || !appt) {
    log.error({ apptErr, businessId, customerId }, 'portal appointment insert failed')
    return NextResponse.json({ error: 'Randevu oluşturulamadı' }, { status: 500 })
  }

  // Paket rezervasyon kaydı — seans düşümü YAPILMAZ, sadece "bu randevu bu pakete ait" işareti
  // Seans used_at: randevu saatine set edilir (ne zaman kullanılacağını gösterir)
  // sessions_used artışı: randevu tamamlanınca updateStatus içinde yapılır
  if (linkedPkg) {
    await admin.from('package_usages').insert({
      business_id: businessId,
      customer_package_id: linkedPkg.id,
      appointment_id: appt.id,
      used_at: `${date}T${startTime}:00`,
      notes: 'Rezervasyon — randevu tamamlanınca seans düşülecek',
    })
  }

  // İşletmeye bildirim (fire-and-forget)
  admin.from('notifications').insert({
    business_id: businessId,
    type: 'appointment',
    title: 'Yeni Online Randevu',
    body: `${customerForNotif?.name || 'Müşteri'} — ${service.name} — ${date} ${startTime}${linkedPkg ? ' (Paket Seansı)' : ''}`,
    related_id: appt.id,
    related_type: 'appointment',
    is_read: false,
  }).then(() => undefined, () => undefined)

  // Audit log (fire-and-forget)
  logPortalAction({
    customerId,
    businessId,
    action: 'appointment_create',
    resource: 'appointment',
    resourceId: appt.id,
    details: {
      customer_name: customerForNotif?.name || null,
      service_name: service.name,
      date,
      time: startTime,
      serviceId,
      staffId,
      package_id: linkedPkg?.id || null,
      package_name: linkedPkg?.package_name || null,
    },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({
    appointment: {
      id: appt.id,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      service: { name: service.name, price: linkedPkg
        ? Math.round((linkedPkg.price_paid / linkedPkg.sessions_total) * 100) / 100
        : service.price,
      },
    },
  })
}
