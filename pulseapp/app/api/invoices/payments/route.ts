import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireWritePermission } from '@/lib/api/with-permission'
import { logAuditServer } from '@/lib/utils/audit'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Faturanın ödeme geçmişi
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx
  const supabase = createServerSupabaseClient()

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get('invoiceId')
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId gerekli' }, { status: 400 })

  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data })
}

// POST: Yeni ödeme kaydet → paid_amount güncelle → status güncelle
export async function POST(req: NextRequest) {
  const auth = await requireWritePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { userId, staffId, staffName, businessId } = auth.ctx
  const supabase = createServerSupabaseClient()

  const body = await req.json()
  const { invoice_id, amount, method, payment_type = 'payment', installment_number, notes } = body

  if (!invoice_id || amount == null || !method) {
    return NextResponse.json({ error: 'invoice_id, amount ve method gerekli' }, { status: 400 })
  }
  // staff_id/staff_name body'den alınmaz — auth context'ten türetilir (audit log bütünlüğü)

  // Faturayı getir (stock_deducted_at dahil) + cross-tenant hard-check
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoice_id)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single()

  if (invoiceError || !invoice) {
    // "Yoksa" ve "başkasının" için uniform 404 — existence leak engelle
    return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
  }

  // İade kontrolü
  const isRefund = payment_type === 'refund'
  const paymentAmount = isRefund ? -Math.abs(amount) : Math.abs(amount)
  const currentPaid = parseFloat(invoice.paid_amount) || 0
  const invoiceTotal = parseFloat(invoice.total) || 0

  // İade limiti: mevcut ödenen tutardan fazla iade yapılamaz
  if (isRefund && Math.abs(amount) > currentPaid + 0.01) {
    return NextResponse.json(
      { error: `İade tutarı mevcut ödenen tutardan (${currentPaid}₺) fazla olamaz` },
      { status: 400 }
    )
  }
  // Fazla ödeme limiti: toplam + 0.01₺ kuruş toleransı üstüne çıkılamaz
  if (!isRefund && invoiceTotal > 0 && currentPaid + Math.abs(amount) > invoiceTotal + 0.01) {
    return NextResponse.json(
      { error: `Ödeme tutarı kalan borcu (${(invoiceTotal - currentPaid).toFixed(2)}₺) aşıyor` },
      { status: 400 }
    )
  }

  // Ödeme kaydı oluştur — staff alanları auth context'ten
  const { data: payment, error: paymentError } = await supabase
    .from('invoice_payments')
    .insert({
      business_id: businessId,
      invoice_id,
      amount: Math.abs(amount),
      method,
      payment_type,
      installment_number: installment_number || null,
      notes: notes || null,
      staff_id: staffId,
      staff_name: staffName,
    })
    .select()
    .single()

  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 })

  // paid_amount güncelle (2 ondalık yuvarlama — floating point hatalarını engeller)
  const newPaidAmount = Math.max(0, Math.round((currentPaid + paymentAmount) * 100) / 100)

  // Status otomatik belirle — sıfırlama ve iade sonrası doğru geçiş
  // invoiceTotal === 0 edge case: hiç ödeme yoksa pending, aksi halde paid
  let newStatus: string
  if (newPaidAmount <= 0) {
    newStatus = 'pending'
  } else if (invoiceTotal <= 0) {
    newStatus = 'paid'
  } else if (newPaidAmount + 0.01 >= invoiceTotal) {
    newStatus = 'paid'
  } else {
    newStatus = 'partial'
  }

  const updateObj: Record<string, unknown> = {
    paid_amount: newPaidAmount,
    status: newStatus,
    updated_at: new Date().toISOString(),
  }

  if (newStatus === 'paid') {
    updateObj.paid_at = new Date().toISOString()
    updateObj.payment_method = method
  }

  // Stok idempotency: iade sonrası yeniden ödeme çift düşmeyi önler
  // stock_deducted_at dolu ise stok zaten düşülmüş; boşsa henüz düşülmemiş
  if (newStatus === 'paid' && !invoice.stock_deducted_at) {
    updateObj.stock_deducted_at = new Date().toISOString()
  } else if (isRefund && invoice.stock_deducted_at) {
    updateObj.stock_deducted_at = null
  }

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update(updateObj)
    .eq('id', invoice_id)
    .eq('business_id', businessId)
    .select('*, customers(name, phone)')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Stok düş: sadece ilk kez paid olduğunda ve POS'tan gelmemişse
  if (newStatus === 'paid' && !invoice.stock_deducted_at && !invoice.pos_transaction_id && updatedInvoice?.items) {
    const items = updatedInvoice.items as Array<{ product_id?: string; type?: string; quantity: number }>
    for (const item of items) {
      if (item.product_id && item.type === 'product') {
        const { data: product } = await supabase
          .from('products')
          .select('stock_count')
          .eq('id', item.product_id)
          .eq('business_id', businessId)
          .single()

        if (product) {
          const newQty = Math.max(0, (product.stock_count || 0) - item.quantity)
          await supabase
            .from('products')
            .update({ stock_count: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)
            .eq('business_id', businessId)

          await supabase.from('stock_movements').insert({
            business_id: businessId,
            product_id: item.product_id,
            type: 'out',
            quantity: item.quantity,
            notes: `Fatura ${invoice.invoice_number} ile satış`,
            created_by: userId,
          })
        }
      }
    }
  }

  // Stok geri yükle: iade yapıldığında ve daha önce düşürülmüşse
  if (isRefund && invoice.stock_deducted_at && !invoice.pos_transaction_id && updatedInvoice?.items) {
    const items = updatedInvoice.items as Array<{ product_id?: string; type?: string; quantity: number }>
    for (const item of items) {
      if (item.product_id && item.type === 'product') {
        const { data: product } = await supabase
          .from('products')
          .select('stock_count')
          .eq('id', item.product_id)
          .eq('business_id', businessId)
          .single()

        if (product) {
          const newQty = (product.stock_count || 0) + item.quantity
          await supabase
            .from('products')
            .update({ stock_count: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)
            .eq('business_id', businessId)

          await supabase.from('stock_movements').insert({
            business_id: businessId,
            product_id: item.product_id,
            type: 'in',
            quantity: item.quantity,
            notes: `Fatura ${invoice.invoice_number} iadesi`,
            created_by: userId,
          })
        }
      }
    }
  }

  // Audit log — staff kimliği auth'tan, IP header'dan
  const ipAddress =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    null
  await logAuditServer({
    businessId,
    staffId,
    staffName,
    action: isRefund ? 'update' : 'pay',
    resource: 'invoice',
    resourceId: invoice_id,
    ipAddress,
    details: {
      amount: Math.abs(amount),
      method,
      payment_type,
      new_paid_amount: newPaidAmount,
      new_status: newStatus,
    },
  })

  return NextResponse.json({ payment, invoice: updatedInvoice })
}
