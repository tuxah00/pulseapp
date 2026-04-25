import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import {
  verifyPaytrCallback,
  parseOrderId,
  parseInvoiceMerchantOid,
  getPlanPriceKurus,
  type PaytrCallbackData,
} from '@/lib/billing/paytr'
import { createLogger } from '@/lib/utils/logger'
import { logSystemAction } from '@/lib/portal/audit'

const log = createLogger({ route: 'api/webhooks/paytr' })

const INVOICE_OID_NOTE_PREFIX = 'paytr_oid:'

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

  // INV-* prefix'i: müşteri portal'dan fatura ödemesi (subscription değil)
  if (data.merchant_oid.startsWith('INV')) {
    return handleInvoicePayment(admin, data)
  }

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

/**
 * Müşteri portal'dan tetiklenen fatura ödemelerini işler.
 *
 *  - merchant_oid → invoice_id parse edilir.
 *  - Fatura çekilir; ödenen tutar `paid_amount`'u aşamaz (kuruş tolerans).
 *  - İdempotency: invoice_payments.notes içinde `paytr_oid:{merchant_oid}` aranır,
 *    varsa skip; yoksa yeni payment satırı eklenir.
 *  - paid_amount + status güncellenir; full paid olunca paid_at + payment_method set.
 *  - Ürün stok düşmesi mevcut endpoint'le ortak: tek fark webhook'tan tetiklenir.
 *  - Audit: actor_type='system', action='invoice_payment_received'.
 */
async function handleInvoicePayment(
  admin: ReturnType<typeof createAdminClient>,
  data: PaytrCallbackData
): Promise<Response> {
  const parsed = parseInvoiceMerchantOid(data.merchant_oid)
  if (!parsed) {
    log.error({ merchantOid: data.merchant_oid }, 'PayTR INV: oid parse hatası')
    return new Response('OK') // PayTR'ye geri çağrı isteme
  }

  const noteMarker = `${INVOICE_OID_NOTE_PREFIX}${data.merchant_oid}`

  // İdempotency: bu oid için payment zaten yazılmış mı?
  const { data: existing } = await admin
    .from('invoice_payments')
    .select('id')
    .eq('invoice_id', parsed.invoiceId)
    .ilike('notes', `%${noteMarker}%`)
    .limit(1)

  if (existing && existing.length > 0) {
    return new Response('OK')
  }

  if (data.status !== 'success') {
    log.warn(
      { merchantOid: data.merchant_oid, invoiceId: parsed.invoiceId, reason: data.failed_reason_msg },
      'PayTR INV: ödeme başarısız'
    )
    return new Response('OK')
  }

  // Faturayı çek
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, business_id, customer_id, total, paid_amount, items, stock_deducted_at, pos_transaction_id, invoice_number')
    .eq('id', parsed.invoiceId)
    .is('deleted_at', null)
    .single()

  if (!invoice) {
    log.error({ invoiceId: parsed.invoiceId, merchantOid: data.merchant_oid }, 'PayTR INV: fatura bulunamadı')
    return new Response('OK')
  }

  const paidKurus = parseInt(data.total_amount, 10)
  if (!Number.isFinite(paidKurus) || paidKurus <= 0) {
    log.error({ paidKurus, merchantOid: data.merchant_oid }, 'PayTR INV: geçersiz tutar')
    return new Response('PAYTR_ERROR: Tutar', { status: 400 })
  }
  const paidAmount = paidKurus / 100
  const total = Number(invoice.total) || 0
  const currentPaid = Number(invoice.paid_amount) || 0
  const remaining = total - currentPaid

  // Tutar guard: kalan borçtan fazla ödeme reddedilir (0.01 ₺ tolerans)
  if (paidAmount > remaining + 0.01) {
    log.error(
      { invoiceId: invoice.id, paidAmount, remaining },
      'PayTR INV: tutar kalan borçtan fazla'
    )
    return new Response('PAYTR_ERROR: Tutar uyuşmuyor', { status: 400 })
  }

  // 1) invoice_payments insert
  const { error: payErr } = await admin
    .from('invoice_payments')
    .insert({
      business_id: invoice.business_id,
      invoice_id: invoice.id,
      amount: paidAmount,
      method: 'card',
      payment_type: 'payment',
      installment_number: null,
      notes: `Online ödeme (PayTR) — ${noteMarker}`,
      staff_id: null,
      staff_name: null,
    })

  if (payErr) {
    log.error({ err: payErr, invoiceId: invoice.id }, 'PayTR INV: invoice_payments insert hatası')
    return new Response('PAYTR_ERROR: DB hatası', { status: 500 })
  }

  // 2) paid_amount + status güncelle
  const newPaid = Math.max(0, Math.round((currentPaid + paidAmount) * 100) / 100)
  let newStatus: string
  if (newPaid <= 0) newStatus = 'pending'
  else if (total <= 0) newStatus = 'paid'
  else if (newPaid + 0.01 >= total) newStatus = 'paid'
  else newStatus = 'partial'

  const updateObj: Record<string, unknown> = {
    paid_amount: newPaid,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }
  if (newStatus === 'paid') {
    updateObj.paid_at = new Date().toISOString()
    updateObj.payment_method = 'card'
  }
  // Stok idempotency
  if (newStatus === 'paid' && !invoice.stock_deducted_at && !invoice.pos_transaction_id) {
    updateObj.stock_deducted_at = new Date().toISOString()
  }

  await admin
    .from('invoices')
    .update(updateObj)
    .eq('id', invoice.id)

  // 3) Stok düş — sadece ilk kez paid olduğunda ve POS değilse
  if (newStatus === 'paid' && !invoice.stock_deducted_at && !invoice.pos_transaction_id && Array.isArray(invoice.items)) {
    const items = invoice.items as Array<{ product_id?: string; type?: string; quantity?: number }>
    for (const item of items) {
      if (item.product_id && item.type === 'product' && item.quantity) {
        const { data: product } = await admin
          .from('products')
          .select('stock_count')
          .eq('id', item.product_id)
          .eq('business_id', invoice.business_id)
          .single()
        if (product) {
          const newQty = Math.max(0, (product.stock_count || 0) - item.quantity)
          await admin
            .from('products')
            .update({ stock_count: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)
            .eq('business_id', invoice.business_id)
          await admin.from('stock_movements').insert({
            business_id: invoice.business_id,
            product_id: item.product_id,
            type: 'out',
            quantity: item.quantity,
            notes: `Fatura ${invoice.invoice_number} ile satış (online ödeme)`,
            created_by: null,
          })
        }
      }
    }
  }

  // 4) Audit log
  await logSystemAction({
    businessId: invoice.business_id,
    action: 'invoice_payment_received',
    resource: 'invoice',
    resourceId: invoice.id,
    details: {
      amount: paidAmount,
      method: 'card',
      source: 'paytr_portal',
      newStatus,
    },
  })

  return new Response('OK')
}
