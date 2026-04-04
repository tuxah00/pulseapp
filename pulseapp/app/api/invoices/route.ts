import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InvoiceItem } from '@/types'

// GET: Fatura listesi (gelişmiş filtreler)
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const customerId = searchParams.get('customer_id')
  const paymentMethod = searchParams.get('payment_method')
  const paymentType = searchParams.get('payment_type')
  const amountMin = searchParams.get('amount_min')
  const amountMax = searchParams.get('amount_max')
  const sortBy = searchParams.get('sort_by') || 'created_at'
  const sortOrder = searchParams.get('sort_order') || 'desc'

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const admin = createAdminClient()
  let query = admin
    .from('invoices')
    .select('*, customers(name, phone)')
    .eq('business_id', businessId)

  if (status && status !== 'all') query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')
  if (customerId) query = query.eq('customer_id', customerId)
  if (paymentMethod) query = query.eq('payment_method', paymentMethod)
  if (paymentType) query = query.eq('payment_type', paymentType)
  if (amountMin) query = query.gte('total', parseFloat(amountMin))
  if (amountMax) query = query.lte('total', parseFloat(amountMax))

  const ascending = sortOrder === 'asc'
  const validSortFields = ['created_at', 'total', 'due_date', 'paid_amount']
  const field = validSortFields.includes(sortBy) ? sortBy : 'created_at'
  query = query.order(field, { ascending })

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ invoices: data })
}

// POST: Yeni fatura oluştur
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const {
    business_id, customer_id, appointment_id, items, tax_rate = 0, notes, due_date,
    staff_id, staff_name, payment_type = 'standard', installment_count, installment_frequency,
    deposit_amount, payment_method,
  } = body

  if (!business_id || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'business_id ve items gerekli' }, { status: 400 })
  }

  // Hesapla
  const subtotal = items.reduce((sum: number, item: InvoiceItem) => sum + item.total, 0)
  const tax_amount = Math.round(subtotal * tax_rate) / 100
  const total = subtotal + tax_amount

  // Fatura numarası oluştur: INV-YYYY-XXXX
  const admin = createAdminClient()
  const year = new Date().getFullYear()
  const { count } = await admin
    .from('invoices')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', business_id)

  const invoiceNumber = `INV-${year}-${String((count || 0) + 1).padStart(4, '0')}`

  // Kapora varsa paid_amount ve status belirle
  let initialPaidAmount = 0
  let initialStatus: string = 'pending'
  if (payment_type === 'deposit' && deposit_amount && deposit_amount > 0) {
    initialPaidAmount = deposit_amount
    initialStatus = deposit_amount >= total ? 'paid' : 'partial'
  }

  const { data: invoice, error } = await admin
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
      staff_id: staff_id || null,
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
    await admin.from('invoice_payments').insert({
      business_id,
      invoice_id: invoice.id,
      amount: deposit_amount,
      method: payment_method || 'cash',
      payment_type: 'deposit',
      staff_id: staff_id || null,
      staff_name: staff_name || null,
    })
  }

  return NextResponse.json({ invoice })
}

// PATCH: Fatura güncelle (durum, ödeme yöntemi vb.)
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const body = await req.json()
  const admin = createAdminClient()
  const updateObj: Record<string, unknown> = { updated_at: new Date().toISOString() }

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
    const { data: existing } = await admin.from('invoices').select('total').eq('id', id).single()
    if (existing) {
      updateObj.paid_amount = existing.total
    }
  }

  const { data: invoice, error } = await admin
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
        const { data: product } = await admin
          .from('products')
          .select('stock_quantity')
          .eq('id', item.product_id)
          .single()

        if (product) {
          const newQty = Math.max(0, (product.stock_quantity || 0) - item.quantity)
          await admin
            .from('products')
            .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
            .eq('id', item.product_id)

          await admin.from('stock_movements').insert({
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

    // Tam ödeme kaydı oluştur (eğer body'de payment_method varsa)
    if (body.payment_method && invoice) {
      await admin.from('invoice_payments').insert({
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
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from('invoices').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
