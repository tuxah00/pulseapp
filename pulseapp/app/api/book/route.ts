import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint, user session yok — businessId filtresi cross-tenant korumasını sağlar
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { isValidUUID } from '@/lib/utils/validate'
import { createBooking } from '@/lib/booking/create-booking'

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

  const body = await req.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })

  const { service_id, staff_id, appointment_date, start_time, customer_name, customer_phone, notes } = body

  if (!service_id || !appointment_date || !start_time || !customer_name || !customer_phone) {
    return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 })
  }
  if (typeof customer_name !== 'string' || customer_name.trim().length < 2 || customer_name.length > 100) {
    return NextResponse.json({ error: 'Geçersiz isim' }, { status: 400 })
  }
  if (typeof customer_phone !== 'string' || customer_phone.replace(/\D/g, '').length < 10) {
    return NextResponse.json({ error: 'Geçersiz telefon' }, { status: 400 })
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(appointment_date)) {
    return NextResponse.json({ error: 'Geçersiz tarih formatı' }, { status: 400 })
  }
  if (!/^\d{2}:\d{2}$/.test(start_time)) {
    return NextResponse.json({ error: 'Geçersiz saat formatı' }, { status: 400 })
  }
  if (!isValidUUID(service_id) || (staff_id && !isValidUUID(staff_id))) {
    return NextResponse.json({ error: 'Geçersiz id' }, { status: 400 })
  }
  if (appointment_date < new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: 'Geçmiş tarihe randevu oluşturulamaz' }, { status: 400 })
  }

  // Çalışma saatleri doğrulaması (legacy endpoint sunucu tarafında zorlar)
  const { data: business } = await supabase
    .from('businesses')
    .select('working_hours')
    .eq('id', businessId)
    .eq('is_active', true)
    .single()

  if (!business) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })

  if (business.working_hours) {
    const wh = business.working_hours as Record<string, { open: string; close: string } | null>
    const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
    const dayKey = dayMap[new Date(appointment_date + 'T00:00:00').getDay()]
    const dayHours = wh[dayKey]
    if (!dayHours) return NextResponse.json({ error: 'Bu gün kapalıdır' }, { status: 400 })
    if (start_time < dayHours.open) return NextResponse.json({ error: 'Çalışma saatleri dışında randevu oluşturulamaz' }, { status: 400 })
  }

  // Personel çözümle: belirtilmişse doğrula, yoksa müsait personeli bul
  let resolvedStaffId: string | null = staff_id || null
  let resolvedDuration: number | undefined

  if (staff_id) {
    const { data: staffRow } = await supabase
      .from('staff_members')
      .select('id')
      .eq('id', staff_id)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .maybeSingle()
    if (!staffRow) return NextResponse.json({ error: 'Personel bulunamadı' }, { status: 404 })
  } else {
    // Otomatik personel atama: izinli olmayan, çakışmasız ilk personeli seç
    const { data: staffList } = await supabase
      .from('staff_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true)

    if (staffList?.length) {
      const sIds = staffList.map(s => s.id)

      // services sorgusu burada yapılıyor; createBooking'e durationMinutes geçirilerek tekrar sorgulanmaz
      const [{ data: offShifts }, { data: svc }, { data: allAppts }] = await Promise.all([
        supabase.from('shifts').select('staff_id').eq('business_id', businessId).eq('shift_date', appointment_date).eq('shift_type', 'off').in('staff_id', sIds),
        supabase.from('services').select('duration_minutes').eq('id', service_id).single(),
        supabase.from('appointments').select('staff_id, start_time, end_time').eq('business_id', businessId).eq('appointment_date', appointment_date).in('status', ['pending', 'confirmed']).is('deleted_at', null).in('staff_id', sIds),
      ])

      if (svc) {
        resolvedDuration = svc.duration_minutes
        const [sh2, sm2] = start_time.split(':').map(Number)
        const endTotal = sh2 * 60 + sm2 + svc.duration_minutes
        const endTime = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`
        const offSet = new Set((offShifts || []).map(s => s.staff_id))
        const reqStart = sh2 * 60 + sm2
        const [eh, em] = endTime.split(':').map(Number)
        const reqEnd = eh * 60 + em

        for (const s of staffList) {
          if (offSet.has(s.id)) continue
          const busy = (allAppts || []).filter(a => a.staff_id === s.id).some(a => {
            const [ash, asm] = a.start_time.split(':').map(Number)
            const [aeh, aem] = a.end_time.split(':').map(Number)
            return ash * 60 + asm < reqEnd && aeh * 60 + aem > reqStart
          })
          if (!busy) { resolvedStaffId = s.id; break }
        }

        if (!resolvedStaffId) {
          return NextResponse.json({ error: 'Bu saat dolu. Lütfen başka bir saat seçin.' }, { status: 409 })
        }
      }
    }
  }

  try {
    const booking = await createBooking(supabase, {
      businessId,
      name: customer_name,
      phone: customer_phone,
      serviceId: service_id,
      staffId: resolvedStaffId,
      date: appointment_date,
      startTime: start_time,
      notes: notes ?? null,
      source: 'web',
      // auto-assign bloğunda zaten çekildiyse duplicate services sorgusunu önler
      ...(resolvedDuration !== undefined && { durationMinutes: resolvedDuration }),
    })
    return NextResponse.json({ success: true, appointment_id: booking.appointmentId })
  } catch (e: unknown) {
    const err = e as Error & { status?: number }
    return NextResponse.json({ error: err.message }, { status: err.status ?? 500 })
  }
}
