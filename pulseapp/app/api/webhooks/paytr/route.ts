import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyPaytrCallback, parseOrderId, type PaytrCallbackData } from '@/lib/billing/paytr'

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
    console.error('PayTR webhook: geçersiz hash', data.merchant_oid)
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

  // payment kaydını güncelle
  await admin
    .from('payments')
    .update({
      status: data.status === 'success' ? 'paid' : 'failed',
      paytr_response: data,
      paid_at: data.status === 'success' ? new Date().toISOString() : null,
    })
    .eq('merchant_oid', data.merchant_oid)

  if (data.status !== 'success') {
    // Başarısız ödeme — sadece logluyoruz
    console.warn('PayTR: ödeme başarısız', data.merchant_oid, data.failed_reason_msg)
    return new Response('OK')
  }

  // merchantOid'den plan ve businessId'yi parse et
  const parsed = parseOrderId(data.merchant_oid)
  if (!parsed) {
    console.error('PayTR: merchant_oid parse hatası', data.merchant_oid)
    return new Response('OK')
  }

  const { businessId, planType } = parsed

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
    console.error('PayTR: abonelik güncelleme hatası', error)
  }

  // PayTR'ye "OK" döndür (zorunlu)
  return new Response('OK')
}
