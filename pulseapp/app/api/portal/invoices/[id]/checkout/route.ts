import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidUUID } from '@/lib/utils/validate'
import { createInvoicePaytrToken } from '@/lib/billing/paytr'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/invoices/[id]/checkout' })

/**
 * POST /api/portal/invoices/[id]/checkout
 *
 * Müşteri faturayı portal'dan ödemek istediğinde PayTR iframe token'ı döndürür.
 * Akış:
 *  1. portal session + invoice ownership doğrulanır (cross-tenant koruma)
 *  2. invoice'da kalan borç varsa createInvoicePaytrToken çağrılır
 *  3. iframe URL + token + merchantOid frontend'e döner; modal iframe'i embed eder
 *  4. Webhook (/api/webhooks/paytr) `INV{...}` prefix'li merchant_oid'leri parse edip
 *     invoice_payments insert + paid_amount/status update yapar
 *
 * PayTR env yoksa 503 — frontend "Şimdi öde" butonunu gizler.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz fatura' }, { status: 400 })
  }

  if (!process.env.PAYTR_MERCHANT_ID) {
    return NextResponse.json(
      { error: 'Online ödeme henüz aktif değil. Lütfen salonla iletişime geçin.' },
      { status: 503 }
    )
  }

  const admin = createAdminClient()

  // Fatura + customer + business birlikte çek (single round-trip)
  const { data: invoice, error: invErr } = await admin
    .from('invoices')
    .select('id, business_id, customer_id, total, paid_amount, status')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .single()

  if (invErr || !invoice) {
    return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
  }

  const total = Number(invoice.total) || 0
  const paid = Number(invoice.paid_amount) || 0
  const remaining = Math.max(0, Math.round((total - paid) * 100) / 100)

  if (remaining <= 0) {
    return NextResponse.json({ error: 'Bu fatura zaten tamamen ödenmiş' }, { status: 400 })
  }

  const [{ data: customer }, { data: business }] = await Promise.all([
    admin
      .from('customers')
      .select('name, email, phone')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .single(),
    admin
      .from('businesses')
      .select('name, address')
      .eq('id', businessId)
      .single(),
  ])

  const email = customer?.email && customer.email.trim().length > 0
    ? customer.email
    : `customer-${customerId.slice(0, 8)}@pulseapp.local`

  try {
    const result = await createInvoicePaytrToken({
      invoiceId: invoice.id,
      businessId,
      email,
      paymentAmountKurus: Math.round(remaining * 100),
      userName: customer?.name || 'Müşteri',
      userAddress: business?.address || 'Türkiye',
      userPhone: customer?.phone || '',
      userIp: getClientIp(request) || '127.0.0.1',
    })

    await logPortalAction({
      customerId,
      businessId,
      action: 'payment_initiated',
      resource: 'invoice',
      resourceId: invoice.id,
      details: { amount: remaining, merchantOid: result.merchantOid },
      ipAddress: getClientIp(request),
    })

    return NextResponse.json({
      iframeUrl: result.iframeUrl,
      token: result.token,
      merchantOid: result.merchantOid,
      amount: remaining,
    })
  } catch (err) {
    log.error({ err, invoiceId: invoice.id }, 'PayTR token oluşturulamadı')
    return NextResponse.json(
      { error: 'Ödeme başlatılamadı. Lütfen tekrar deneyin.' },
      { status: 502 }
    )
  }
}
