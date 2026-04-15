import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Faturanın ödeme geçmişi
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const invoiceId = searchParams.get('invoiceId')
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId gerekli' }, { status: 400 })

  const { data, error } = await supabase
    .from('invoice_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payments: data })
}

// POST: Yeni ödeme kaydet → paid_amount güncelle → status güncelle
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { invoice_id, amount, method, payment_type = 'payment', installment_number, notes, staff_id, staff_name } = body

  if (!invoice_id || !amount || !method) {
    return NextResponse.json({ error: 'invoice_id, amount ve method gerekli' }, { status: 400 })
  }

  // Faturayı getir
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoice_id)
    .is('deleted_at', null)
    .single()

  if (invoiceError || !invoice) {
    return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
  }

  // İade kontrolü
  const isRefund = payment_type === 'refund'
  const paymentAmount = isRefund ? -Math.abs(amount) : Math.abs(amount)
  const currentPaid = parseFloat(invoice.paid_amount) || 0
  const invoiceTotal = parseFloat(invoice.total)

  // İade limiti: mevcut ödenen tutardan fazla iade yapılamaz
  if (isRefund && Math.abs(amount) > currentPaid + 0.01) {
    return NextResponse.json(
      { error: `İade tutarı mevcut ödenen tutardan (${currentPaid}₺) fazla olamaz` },
      { status: 400 }
    )
  }

  // Ödeme kaydı oluştur
  const { data: payment, error: paymentError } = await supabase
    .from('invoice_payments')
    .insert({
      business_id: invoice.business_id,
      invoice_id,
      amount: Math.abs(amount),
      method,
      payment_type,
      installment_number: installment_number || null,
      notes: notes || null,
      staff_id: staff_id || null,
      staff_name: staff_name || null,
    })
    .select()
    .single()

  if (paymentError) return NextResponse.json({ error: paymentError.message }, { status: 500 })

  // paid_amount güncelle (2 ondalık yuvarlama — floating point hatalarını engeller)
  const newPaidAmount = Math.max(0, Math.round((currentPaid + paymentAmount) * 100) / 100)

  // Status otomatik belirle (0.01₺ epsilon ile float precision koruması)
  let newStatus = invoice.status
  if (newPaidAmount + 0.01 >= invoiceTotal) {
    newStatus = 'paid'
  } else if (newPaidAmount > 0) {
    newStatus = 'partial'
  } else {
    newStatus = 'pending'
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

  const { data: updatedInvoice, error: updateError } = await supabase
    .from('invoices')
    .update(updateObj)
    .eq('id', invoice_id)
    .select('*, customers(name, phone)')
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // Fatura tam ödendiyse stok düş (POS'tan gelen faturalarda POS zaten düşürdüğü için atla)
  if (newStatus === 'paid' && invoice.status !== 'paid' && !invoice.pos_transaction_id && updatedInvoice?.items) {
    const items = updatedInvoice.items as Array<{ product_id?: string; type?: string; quantity: number }>
    for (const item of items) {
      if (item.product_id && item.type === 'product') {
        const { data: product } = await supabase
          .from('products')
          .select('stock_count')
          .eq('id', item.product_id)
          .single()

        if (product) {
          const newQty = Math.max(0, (product.stock_count || 0) - item.quantity)
          await supabase
            .from('products')
            .update({ stock_count: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)

          await supabase.from('stock_movements').insert({
            business_id: invoice.business_id,
            product_id: item.product_id,
            type: 'out',
            quantity: item.quantity,
            notes: `Fatura ${invoice.invoice_number} ile satış`,
            created_by: user.id,
          })
        }
      }
    }
  }

  // İade durumunda stok geri yükle (daha önce düşürülmüşse)
  if (isRefund && invoice.status === 'paid' && !invoice.pos_transaction_id && updatedInvoice?.items) {
    const items = updatedInvoice.items as Array<{ product_id?: string; type?: string; quantity: number }>
    for (const item of items) {
      if (item.product_id && item.type === 'product') {
        const { data: product } = await supabase
          .from('products')
          .select('stock_count')
          .eq('id', item.product_id)
          .single()

        if (product) {
          const newQty = (product.stock_count || 0) + item.quantity
          await supabase
            .from('products')
            .update({ stock_count: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)

          await supabase.from('stock_movements').insert({
            business_id: invoice.business_id,
            product_id: item.product_id,
            type: 'in',
            quantity: item.quantity,
            notes: `Fatura ${invoice.invoice_number} iadesi`,
            created_by: user.id,
          })
        }
      }
    }
  }

  return NextResponse.json({ payment, invoice: updatedInvoice })
}
