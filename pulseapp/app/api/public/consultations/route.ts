// app/api/public/consultations/route.ts
// Son adım: tüm form verisini alır, consultation_request oluşturur, bildirim gönderir.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { verifyTempToken } from '@/lib/utils/temp-token'
import { normalizePhone } from '@/lib/utils/phone'
import { consultationCreateSchema } from '@/lib/schemas'
import { logAuditServer } from '@/lib/utils/audit'

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.publicBooking)
  if (rl.limited) return rl.response

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const parsed = consultationCreateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Eksik veya hatalı bilgi.', details: parsed.error.flatten() }, { status: 400 })
  }

  const {
    tempToken, businessId, fullName, phone, email, age,
    serviceId, serviceLabel, question, healthNotes,
    photoUrls, consents, website,
  } = parsed.data

  // Honeypot
  if (website && website.length > 0) {
    return NextResponse.json({ ok: true, requestId: 'honeypot' })
  }

  // Token doğrula
  const payload = verifyTempToken(tempToken)
  if (!payload || payload.businessId !== businessId) {
    return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş oturum.' }, { status: 401 })
  }

  const { customerId } = payload

  // KVKK + sağlık verisi onayı zorunlu
  if (!consents.kvkk || !consents.healthData) {
    return NextResponse.json({ error: 'KVKK ve sağlık verisi onayı zorunludur.' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent') || null

  const supabase = createAdminClient()

  // 24 saatte 3 talep sınırı (init'te de kontrol edildi ama final submit'te tekrar kontrol)
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { count } = await supabase
    .from('consultation_requests')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('phone', normalizedPhone)
    .gte('created_at', since24h)

  if (count && count >= 3) {
    return NextResponse.json({ error: 'Günlük talep limitine ulaşıldı.' }, { status: 429 })
  }

  // Müşteri adını güncelle (init'te sadece lead oluşturduk)
  await supabase
    .from('customers')
    .update({ name: fullName.trim() })
    .eq('id', customerId)
    .eq('business_id', businessId)

  // ConsultationRequest oluştur
  const { data: request, error: insertError } = await supabase
    .from('consultation_requests')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      full_name: fullName.trim(),
      phone: normalizedPhone,
      email: email || null,
      age: age || null,
      service_id: serviceId || null,
      service_label: serviceLabel || null,
      question,
      health_notes: healthNotes || null,
      photo_urls: photoUrls,
      status: 'pending',
      consent_kvkk: consents.kvkk,
      consent_health_data: consents.healthData,
      consent_marketing: consents.marketing,
      consent_ip: ip,
      consent_user_agent: ua,
      source_ip: ip,
    })
    .select('id')
    .single()

  if (insertError || !request) {
    return NextResponse.json({ error: 'Talep kaydedilemedi.' }, { status: 500 })
  }

  // KVKK onay kaydı
  try {
    const consentRecords = [
      { business_id: businessId, customer_id: customerId, consent_type: 'kvkk', given: true, ip_address: ip, user_agent: ua },
      { business_id: businessId, customer_id: customerId, consent_type: 'health_data', given: true, ip_address: ip, user_agent: ua },
    ]
    if (consents.marketing) {
      consentRecords.push({ business_id: businessId, customer_id: customerId, consent_type: 'marketing', given: true, ip_address: ip, user_agent: ua })
    }
    await supabase.from('consent_records').insert(consentRecords)
  } catch { /* KVKK kaydı kritik değil, ana akışı durdurmaz */ }

  // Bildirimleri işletmenin tüm yetkili personeline gönder
  try {
    const { data: staffList } = await supabase
      .from('staff_members')
      .select('id, user_id')
      .eq('business_id', businessId)
      .eq('is_active', true)

    if (staffList && staffList.length > 0) {
      // notifications tablosu business-level (per-staff değil) — tek satır yeterli
      await supabase.from('notifications').insert({
        business_id: businessId,
        type: 'consultation_request',
        title: 'Yeni Ön Konsültasyon Talebi',
        body: `${fullName} adlı aday değerlendirme bekliyor.`,
        related_type: 'consultation_request',
        related_id: request.id,
        is_read: false,
      })
    }
  } catch { /* bildirim hatası kritik değil */ }

  // Audit log (actor_type: customer)
  await logAuditServer({
    businessId,
    staffId: null,
    staffName: fullName,
    action: 'create',
    resource: 'consultation_request',
    resourceId: request.id,
    details: { phone: normalizedPhone, hasPhotos: photoUrls.length > 0 },
    ipAddress: ip,
  })

  return NextResponse.json({ ok: true, requestId: request.id })
}
