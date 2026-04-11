import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'
import { validateBody, parsePaginationParams } from '@/lib/api/validate'
import { invoiceCreateSchema, invoicePatchSchema } from '@/lib/schemas'
import type { InvoiceItem } from '@/types'

// GET: Fatura listesi (gelişmiş filtreler)
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')
  const fromDate = searchParams.get('from')
  const toDate = searchParams.get('to')
  const customerId = searchParams.get('customer_id')
  const paymentMethod = searchParams.get('payment_method')
  const paymentType = searchParams.get('payment_type')
  const amountMin = searchParams.get('amount_min')
  const amountMax = searchParams.get('amount_max')
  const sortBy = searchParams.get('sort_by') || 'created_at'
  const sortOrder = searchParams.get('sort_order') || 'desc'
  const { page, pageSize, from, to } = parsePaginationParams(searchParams)

  const showDeleted = searchParams.get('showDeleted') === 'true'

  const supabase = createServerSupabaseClient()
  let query = supabase
    .from('invoices')
    .select('*, customers(name, phone)', { count: 'exact' })
    .eq('business_id', businessId)

  if (showDeleted) {
    query = query.not('deleted_at', 'is', null)
  } else {
    query = query.is('deleted_at', null)
  }

  if (!showDeleted && status && status !== 'all') query = query.eq('status', status)
  if (fromDate) query = query.gte('created_at', fromDate)
  if (toDate) query = query.lte('created_at', toDate + 'T23:59:59Z')
  if (customerId) query = query.eq('customer_id', customerId)
  if (paymentMethod) query = query.eq('payment_method', paymentMethod)
  if (paymentType) query = query.eq('payment_type', paymentType)
  if (amountMin) query = query.gte('total', parseFloat(amountMin))
  if (amountMax) query = query.lte('total', parseFloat(amountMax))

  const ascending = sortOrder === 'asc'
  const validSortFields = ['created_at', 'total', 'due_date', 'paid_amount']
  const field = validSortFields.includes(sortBy) ? sortBy : 'created_at'
  query = query.order(field, { ascending })
    .range(from, to)

  const { data, error, count } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data, total: count || 0 })
}

// POST: Yeni fatura oluştur
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId, staffId } = auth.ctx

  const result = await validateBody(req, invoiceCreateSchema)
  if (!result.ok) return result.response
  const {
    customer_id, appointment_id, items, tax_rate, notes, due_date,
    staff_name, payment_type, installment_count, installment_frequency,
    deposit_amount, payment_method,
  } = result.data
  const business_id = businessId

  // Hesapla
  const subtotal = items.reduce((sum, item) => sum + item.total, 0)
  const tax_amount = Math.round(subtotal * tax_rate) / 100
  const total = subtotal + tax_amount

  // Fatura numarası oluştur: INV-YYYY-XXXX
  const supabase = createServerSupabaseClient()
  const year = new Date().getFullYear()
  const { count } = await supabase
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', business_id)
    .is('deleted_at', null)

  const invoiceNumber = `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`

  // Kapora varsa paid_amount ve status belirle
  let initialPaidAmount = 0
  let initialStatus: string = 'pending'
  if (payment_type === 'deposit' && deposit_amount && deposit_amount > 0) {
    initialPaidAmount = deposit_amount
    initialStatus = deposit_amount >= total ? 'paid' : 'partial'
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .insert({
      business_id,
      customer_id: customer_id || null,
      appointment_id: appointment_id || null,
      invoice_number: invoiceNumber,
      items,
      subtotal,
      tax_rate: tax_rate || 0,
      tax_amount,
      total,
      paid_amount: initialPaidAmount,
      status: initialStatus,
      notes: notes || null,
      due_date: due_date || null,
      staff_id: staffId,
      staff_name: staff_name || null,
      payment_type: payment_type || 'standard',
      installment_count: installment_count || null,
      installment_frequency: installment_frequency || null,
    })
    .select('*, customers(name, phone)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Kapora ödeme kaydı oluştur
  if (payment_type === 'deposit' && deposit_amount && deposit_amount > 0 && invoice) {
    await supabase.from('invoice_payments').insert({
      business_id,
      invoice_id: invoice.id,
      amount: deposit_amount,
      method: payment_method || 'cash',
      payment_type: 'deposit',
      staff_id: staffId,
      staff_name: staff_name || null,
    })
  }

  return NextResponse.json({ invoice })
}

// PATCH: Fatura güncelle (durum, ödeme yöntemi vb.)
export async function PATCH(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { userId, businessId: _bId } = auth.ctx

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const result = await validateBody(req, invoicePatchSchema)
  if (!result.ok) return result.response
  const body = result.data
  const supabase = createServerSupabaseClient()
  const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() }

  // Çöp kutusundan geri al
  if (body.restore === true) {
    updateObj.deleted_at = null
    const { data: invoice, error } = await supabase
      .from('invoices')
      .update(updateObj)
      .eq('id', id)
      .select('*, customers(name, phone)')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ invoice })
  }

  if (body.status !== undefined) {
    updateObj.status = body.status
    if (body.status === 'paid') {
      updateObj.paid_at = new Date().toISOString()
      if (body.payment_method) updateObj.payment_method = body.payment_method
    }
  }
  if (body.payment_method !== undefined) updateObj.payment_method = body.payment_method
  if (body.notes !== undefined) updateObj.notes = body.notes
  if (body.due_date !== undefined) updateObj.due_date = body.due_date
  if (body.paid_amount !== undefined) updateObj.paid_amount = body.paid_amount

  // Tam ödeme durumunda paid_amount'u total'e eşitle
  if (body.status === 'paid') {
    const { data: existing } = await supabase.from('invoices').select('total').eq('id', id).single()
    if (existing) {
      updateObj.paid_amount = existing.total
    }
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .update(updateObj)
    .eq('id', id)
    .select('*, customers(name, phone)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Fatura ödendi → ürün kalemlerini stoktan düş
  if (body.status === 'paid' && invoice?.items && Array.isArray(invoice.items)) {
    for (const item of invoice.items as InvoiceItem[]) {
      if (item.product_id && item.type === 'product') {
        const { data: product } = await supabase
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single()

        if (product) {
          const newQty = Math.max(0, (product.stock_quantity || 0) - item.quantity)
          await supabase
            .from('products')
            .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)

          await supabase.from('stock_movements').insert({
            business_id: invoice.business_id,
            product_id: item.product_id,
            type: 'out',
            quantity: item.quantity,
            notes: `Fatura ${invoice.invoice_number} ile satış`,
            created_by: userId,
          })
        }
      }
    }

    // Tam ödeme kaydı oluştur (eğer body'de payment_method varsa)
    if (body.payment_method && invoice) {
      await supabase.from('invoice_payments').insert({
        business_id: invoice.business_id,
        invoice_id: invoice.id,
        amount: invoice.total - (invoice.paid_amount || 0) + (invoice.total || 0), // kalan tutar
        method: body.payment_method,
        payment_type: 'payment',
        staff_id: body.staff_id || null,
        staff_name: body.staff_name || null,
      })
    }
  }

  return NextResponse.json({ invoice })
}

// DELETE: Fatura sil
export async function DELETE(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const supabase = createServerSupabaseClient()
  const { error } = await supabase
    .from('invoices')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .is('deleted_at', null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
