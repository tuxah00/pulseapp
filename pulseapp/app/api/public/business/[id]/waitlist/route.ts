import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { waitlistCreateSchema } from '@/lib/schemas'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'

const supabase = createAdminClient()

// GET — Telefona göre bekleme listesi kayıtları (müşteri portalı)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isValidUUID(params.id)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const phone = request.nextUrl.searchParams.get('phone')
  if (!phone) return NextResponse.json({ error: 'Telefon gerekli' }, { status: 400 })

  const normalized = normalizePhone(phone)

  const { data: entries, error } = await supabase
    .from('waitlist_entries')
    .select('id, customer_name, customer_phone, preferred_date, preferred_time_start, is_active, created_at, services:service_id(name), staff_members:staff_id(name)')
    .eq('business_id', params.id)
    .eq('is_active', true)
    .or(phoneOrFilter(normalized))
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ entries: entries || [] })
}

// DELETE — Müşteri kendi kaydını iptal eder (telefon doğrulaması)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isValidUUID(params.id)) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const entryId = request.nextUrl.searchParams.get('entryId')
  const phone = request.nextUrl.searchParams.get('phone')
  if (!entryId || !phone) return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 })

  const normalized = normalizePhone(phone)

  // Kaydın bu işletmeye ve bu telefona ait olduğunu doğrula
  const { data: entry } = await supabase
    .from('waitlist_entries')
    .select('id')
    .eq('id', entryId)
    .eq('business_id', params.id)
    .or(phoneOrFilter(normalized))
    .single()

  if (!entry) return NextResponse.json({ error: 'Kayıt bulunamadı' }, { status: 404 })

  const { error } = await supabase
    .from('waitlist_entries')
    .delete()
    .eq('id', entryId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const rl = checkRateLimit(request, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  const result = await validateBody(request, waitlistCreateSchema)
  if (!result.ok) return result.response
  const { customerName, customerPhone, serviceId, staffId, preferredDate, preferredTime, autoBookOnMatch } = result.data

  // İşletmenin var olduğunu doğrula
  const { data: business } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const normalizedPhone = normalizePhone(customerPhone)

  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', params.id)
    .or(phoneOrFilter(normalizedPhone))
    .eq('is_active', true)
    .limit(1)

  // Mevcut müşteri yoksa misafir olarak kaydı aç — auto_book_on_match ve fill-gap
  // akışları customer_id gerektiriyor.
  let customerId = existingCustomers?.[0]?.id || null
  if (!customerId) {
    const { data: newCustomer, error: customerError } = await supabase
      .from('customers')
      .insert({
        business_id: params.id,
        name: customerName,
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
      console.error('Misafir müşteri oluşturulamadı:', customerError)
      return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  // HH:MM formatını HH:MM:00'a normalize et
  const normalizedTime = preferredTime
    ? (preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime)
    : null

  const { error: insertError } = await supabase
    .from('waitlist_entries')
    .insert({
      business_id: params.id,
      customer_id: customerId,
      customer_name: customerName,
      customer_phone: normalizedPhone,
      service_id: serviceId || null,
      staff_id: staffId || null,
      preferred_date: preferredDate || null,
      preferred_time_start: normalizedTime,
      auto_book_on_match: !!autoBookOnMatch,
      is_notified: false,
      is_active: true,
    })

  if (insertError) {
    console.error('Bekleme listesi kayıt hatası:', insertError)
    return NextResponse.json({ error: 'Kayıt oluşturulamadı' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
