import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

// POST — Müşteri "havale yaptım / ödedim" bildirimi.
// invoice_payment_claims tablosuna kayıt + personele notification düşer.
// Personel onayladığında invoice.status manuel olarak güncellenir.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rl = checkRateLimit(request, RATE_LIMITS.general)
  if (rl.limited) return rl.response

  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  let body: {
    payment_date?: string
    payment_method?: string
    amount?: number
    iban_last4?: string | null
    note?: string | null
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const amount = Number(body.amount)
  if (!(amount > 0)) {
    return NextResponse.json({ error: 'Geçerli bir tutar girin' }, { status: 400 })
  }
  if (body.payment_date && !/^\d{4}-\d{2}-\d{2}$/.test(body.payment_date)) {
    return NextResponse.json({ error: 'Geçersiz tarih' }, { status: 400 })
  }
  const ibanLast4 = (body.iban_last4 || '').toString().trim()
  if (ibanLast4 && !/^\d{4}$/.test(ibanLast4)) {
    return NextResponse.json({ error: 'IBAN son 4 hane sadece rakam olmalı' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Faturanın gerçekten bu müşteriye ait olduğunu doğrula (cross-tenant koruma)
  const { data: invoice } = await admin
    .from('invoices')
    .select('id, invoice_number, total, paid_amount, status')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle()

  if (!invoice) {
    return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
  }
  if (invoice.status === 'paid') {
    return NextResponse.json({ error: 'Bu fatura zaten ödendi' }, { status: 409 })
  }

  // Aynı fatura için açık (pending) bir claim varsa duplicate engelle
  const { data: existing } = await admin
    .from('invoice_payment_claims')
    .select('id')
    .eq('invoice_id', invoice.id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return NextResponse.json({
      error: 'Bu fatura için zaten bekleyen bir bildiriminiz var. Personel onayını bekliyor.',
    }, { status: 409 })
  }

  // Müşteri adı (notification başlığı için)
  const { data: customer } = await admin
    .from('customers')
    .select('name')
    .eq('id', customerId)
    .maybeSingle()

  const { data: claim, error: claimErr } = await admin
    .from('invoice_payment_claims')
    .insert({
      invoice_id: invoice.id,
      customer_id: customerId,
      business_id: businessId,
      payment_date: body.payment_date || null,
      payment_method: body.payment_method || null,
      iban_last4: ibanLast4 || null,
      amount,
      note: body.note?.toString().slice(0, 500) || null,
      status: 'pending',
    })
    .select('id')
    .single()

  if (claimErr || !claim) {
    return NextResponse.json({ error: 'Bildirim kaydedilemedi' }, { status: 500 })
  }

  // Personele bildirim
  await admin.from('notifications').insert({
    business_id: businessId,
    type: 'customer_payment_claim',
    title: `Ödeme bildirimi: ${customer?.name || 'Müşteri'} — ${invoice.invoice_number}`,
    body: `Tutar: ${amount.toFixed(2)} ₺ · Yöntem: ${body.payment_method || 'belirtilmedi'}${ibanLast4 ? ` · IBAN ****${ibanLast4}` : ''}${body.note ? ` · Not: ${body.note}` : ''}`,
    related_id: invoice.id,
    related_type: 'invoice',
  })

  return NextResponse.json({ success: true, claimId: claim.id })
}
