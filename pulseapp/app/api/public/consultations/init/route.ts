// app/api/public/consultations/init/route.ts
// 1. adım: minimal bilgi (businessId + ad + telefon) ile müşteri oluşturur,
// foto upload için kısa ömürlü tempToken döner.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { normalizePhone, toE164Phone } from '@/lib/utils/phone'
import { signTempToken } from '@/lib/utils/temp-token'
import { consultationInitSchema } from '@/lib/schemas'

export async function POST(req: NextRequest) {
  // IP rate limit
  const rl = checkRateLimit(req, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 }) }

  const parsed = consultationInitSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Eksik veya hatalı bilgi.' }, { status: 400 })
  }

  const { businessId, fullName, phone, website } = parsed.data

  // Honeypot kontrolü
  if (website && website.length > 0) {
    // Bot tuzağı — sessizce başarılı dön
    return NextResponse.json({ tempToken: 'honeypot', customerId: 'honeypot' })
  }

  // Telefon normalizasyonu
  const normalizedPhone = normalizePhone(phone)
  const e164Phone = toE164Phone(normalizedPhone)

  const supabase = createAdminClient()

  // İşletme var mı kontrolü
  const { data: biz } = await supabase
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .single()

  if (!biz) {
    return NextResponse.json({ error: 'İşletme bulunamadı.' }, { status: 404 })
  }

  // 24 saatte 3 talep sınırı
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('consultation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('phone', normalizedPhone)
    .gte('created_at', since24h)

  if (count && count >= 3) {
    return NextResponse.json(
      { error: 'Bugün için maksimum talep sayısına ulaşıldı. Lütfen yarın tekrar deneyin.' },
      { status: 429 }
    )
  }

  // Müşteri upsert (lead — is_active=false, lead_source='consultation')
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('business_id', businessId)
    .or(`phone.eq.${normalizedPhone},phone.eq.${e164Phone}`)
    .maybeSingle()

  let customerId: string

  if (existing) {
    customerId = existing.id
    // lead_source'u güncelle (aktif müşteri ise is_active korunur)
    await supabase
      .from('customers')
      .update({ lead_source: 'consultation' })
      .eq('id', customerId)
      .is('lead_source', null)
  } else {
    const { data: newCustomer, error: insertError } = await supabase
      .from('customers')
      .insert({
        business_id: businessId,
        name: fullName.trim(),
        phone: normalizedPhone,
        is_active: false,
        lead_source: 'consultation',
        segment: 'new',
      })
      .select('id')
      .single()

    if (insertError || !newCustomer) {
      return NextResponse.json({ error: 'Müşteri oluşturulamadı.' }, { status: 500 })
    }
    customerId = newCustomer.id
  }

  const tempToken = signTempToken({ businessId, customerId })

  return NextResponse.json({ tempToken, customerId })
}
