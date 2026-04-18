import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { waitlistCreateSchema } from '@/lib/schemas'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'

const supabase = createAdminClient()

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

  // HH:MM formatını HH:MM:00'a normalize et
  const normalizedTime = preferredTime
    ? (preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime)
    : null

  const { error: insertError } = await supabase
    .from('waitlist_entries')
    .insert({
      business_id: params.id,
      customer_id: existingCustomers?.[0]?.id || null,
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
