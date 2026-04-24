import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint, user session yok — businessId filtresi cross-tenant korumasını sağlar
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { isValidUUID } from '@/lib/utils/validate'
import { createBooking } from '@/lib/booking/create-booking'
import { checkWorkingHours, type WorkingHoursMap } from '@/lib/booking/working-hours'
import { autoAssignStaff } from '@/lib/booking/auto-assign-staff'
import { legacyBookingSchema } from '@/lib/schemas'

export async function GET(req: NextRequest) {
  const supabase = createAdminClient()
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'Geçersiz businessId' }, { status: 400 })
  }

  const { data: business, error: bizErr } = await supabase
    .from('businesses')
    // settings alanı dahil edilmez — iç yapılandırma public endpoint'te açıklanmamalı
    .select('id, name, sector, working_hours, phone, address, city, district')
    .eq('id', businessId)
    .eq('is_active', true)
    .single()

  if (bizErr || !business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const [{ data: services }, { data: staff }] = await Promise.all([
    supabase
      .from('services')
      .select('id, name, description, duration_minutes, price')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('sort_order'),
    supabase
      .from('staff_members')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true),
  ])

  return NextResponse.json({ business, services: services || [], staff: staff || [] })
}

export async function POST(req: NextRequest) {
  const supabase = createAdminClient()
  const businessId = req.nextUrl.searchParams.get('businessId')
  if (!businessId || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'Geçersiz businessId' }, { status: 400 })
  }

  const rl = checkRateLimit(req, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  const parsed = await validateBody(req, legacyBookingSchema)
  if (!parsed.ok) return parsed.response

  const {
    customer_name: customerName,
    customer_phone: customerPhone,
    service_id: serviceId,
    staff_id: staffIdInput,
    appointment_date: date,
    start_time: startTime,
    notes,
  } = parsed.data

  // Kampanya attribution: ?c=<campaign_recipient_id>
  const campaignRecipientIdRaw = req.nextUrl.searchParams.get('c')
  const campaignRecipientId =
    campaignRecipientIdRaw && isValidUUID(campaignRecipientIdRaw)
      ? campaignRecipientIdRaw
      : null

  // Geçmiş tarih kontrolü
  if (date < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json(
      { error: 'Geçmiş tarihe randevu oluşturulamaz' },
      { status: 400 },
    )
  }

  // Çalışma saati doğrulaması
  const { data: business } = await supabase
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .eq('is_active', true)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const whError = checkWorkingHours(
    business.working_hours as WorkingHoursMap | null,
    date,
    startTime,
  )
  if (whError) {
    return NextResponse.json({ error: whError.error }, { status: whError.status })
  }

  // Personel çözümle: belirtilmişse doğrula, yoksa müsait personeli bul
  let resolvedStaffId: string | null = staffIdInput ?? null
  let resolvedDuration: number | undefined

  if (staffIdInput) {
    const { data: staffRow } = await supabase
      .from('staff_members')
      .select('id')
      .eq('id', staffIdInput)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()
    if (!staffRow) {
      return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
    }
  } else {
    const assigned = await autoAssignStaff(supabase, {
      businessId,
      serviceId,
      date,
      startTime,
    })
    if (!assigned.ok) {
      return NextResponse.json({ error: assigned.error }, { status: assigned.status })
    }
    resolvedStaffId = assigned.staffId
    resolvedDuration = assigned.durationMinutes
  }

  try {
    const booking = await createBooking(supabase, {
      businessId,
      name: customerName,
      phone: customerPhone,
      serviceId,
      staffId: resolvedStaffId,
      date,
      startTime,
      notes: notes ?? null,
      source: 'web',
      // auto-assign bloğunda zaten çekildiyse duplicate services sorgusunu önler
      ...(resolvedDuration !== undefined && { durationMinutes: resolvedDuration }),
      ...(campaignRecipientId && { campaignRecipientId }),
    })
    return NextResponse.json({ success: true, appointment_id: booking.appointmentId })
  } catch (e: unknown) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
