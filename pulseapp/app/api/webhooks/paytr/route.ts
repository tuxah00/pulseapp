import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaytrCallback, parseOrderId, getPlanPriceKurus, type PaytrCallbackData } from '@/lib/billing/paytr'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/webhooks/paytr' })

// POST: PayTR ödeme sonucu webhook
export async function POST(req: NextRequest) {
  let data: PaytrCallbackData

  try {
    const text = await req.text()
    const params = new URLSearchParams(text)
    data = Object.fromEntries(params.entries()) as unknown as PaytrCallbackData
  } catch {
    return new Response('PAYTR_ERROR: Invalid body', { status: 400 })
  }

  // İmza doğrula
  if (!verifyPaytrCallback(data)) {
    log.error({ merchantOid: data.merchant_oid }, 'PayTR webhook: geçersiz hash')
    return new Response('PAYTR_ERROR: Hash mismatch', { status: 400 })
  }

  const admin = createAdminClient()

  // İdempotency: bu merchant_oid zaten işlenmişse tekrar çalıştırma
  const { data: existingPayment } = await admin
    .from('payments')
    .select('id, status')
    .eq('merchant_oid', data.merchant_oid)
    .maybeSingle()

  if (existingPayment?.status === 'paid' && data.status === 'success') {
    // Zaten işlenmiş — PayTR'nin tekrar gönderimi; OK dön ve çık
    return new Response('OK')
  }

  // payment kaydını güncelle — sadece henüz 'paid' olmayan satırlar (race'e karşı atomik transition)
  const { data: updatedRows } = await admin
    .from('payments')
    .update({
      status: data.status === 'success' ? 'paid' : 'failed',
      paytr_response: data,
      paid_at: data.status === 'success' ? new Date().toISOString() : null,
    })
    .eq('merchant_oid', data.merchant_oid)
    .neq('status', 'paid')
    .select('id')

  if (data.status !== 'success') {
    // Başarısız ödeme — sadece logluyoruz
    log.warn({ merchantOid: data.merchant_oid, failedReason: data.failed_reason_msg }, 'PayTR: ödeme başarısız')
    return new Response('OK')
  }

  // merchantOid'den plan ve businessId'yi parse et
  const parsed = parseOrderId(data.merchant_oid)
  if (!parsed) {
    log.error({ merchantOid: data.merchant_oid }, 'PayTR: merchant_oid parse hatası')
    return new Response('OK')
  }

  const { businessId, planType } = parsed

  // Tutar doğrulaması — merchant_oid'deki planType ile ödenen tutar eşleşmeli
  // (plan escalation saldırısına karşı: starter ödeyip pro aktive etme)
  const expectedKurus = getPlanPriceKurus(planType)
  const paidKurus = parseInt(data.total_amount, 10)
  if (!Number.isFinite(paidKurus) || paidKurus !== expectedKurus) {
    log.error({ merchantOid: data.merchant_oid, planType, expectedKurus, paidKurus }, 'PayTR: tutar uyuşmazlığı')
    return new Response('PAYTR_ERROR: Tutar uyuşmuyor', { status: 400 })
  }

  // Çifte uzatma koruması: transition 'paid'e gerçekten burada gerçekleşmediyse abonelik uzatma
  if (!updatedRows || updatedRows.length === 0) {
    return new Response('OK')
  }

  // Abonelik sonu tarihini hesapla (1 ay) — ay sonu taşması koruması (31 Ocak → 28 Şubat)
  const nextBillingDate = new Date()
  const originalDay = nextBillingDate.getDate()
  nextBillingDate.setDate(1)
  nextBillingDate.setMonth(nextBillingDate.getMonth() + 1)
  const lastDayOfNextMonth = new Date(nextBillingDate.getFullYear(), nextBillingDate.getMonth() + 1, 0).getDate()
  nextBillingDate.setDate(Math.min(originalDay, lastDayOfNextMonth))

  // İşletmenin aboneliğini güncelle
  const { error } = await admin
    .from('businesses')
    .update({
      subscription_plan: planType,
      subscription_status: 'active',
      subscription_ends_at: nextBillingDate.toISOString(),
    })
    .eq('id', businessId)

  if (error) {
    log.error({ err: error }, 'PayTR: abonelik güncelleme hatası')
  }

  // PayTR'ye "OK" döndür (zorunlu)
  return new Response('OK')
}
