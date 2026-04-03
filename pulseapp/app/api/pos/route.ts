import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { POSItem, InvoiceItem, POSPaymentStatus } from '@/types'

// GET: İşlem listesi
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const admin = createAdminClient()
  let query = admin
    .from('pos_transactions')
    .select('*, customers(name, phone), staff_members(name)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')

  const { data, error } = await query.limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transactions: data })
}

// POST: Yeni işlem oluştur + otomatik fatura + stok düşme
export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const {
    business_id, customer_id, appointment_id, staff_id,
    items, discount_amount = 0, discount_type, tax_rate = 0,
    payments, notes, transaction_type = 'sale',
  } = body

  if (!business_id || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'business_id ve items gerekli' }, { status: 400 })
  }
  if (!payments || !Array.isArray(payments) || payments.length === 0) {
    return NextResponse.json({ error: 'payments gerekli' }, { status: 400 })
  }

  const subtotal = items.reduce((sum: number, item: POSItem) => sum + item.total, 0)

  let discountCalc = 0
  if (discount_type === 'percentage') {
    discountCalc = Math.round(subtotal * (discount_amount / 100) * 100) / 100
  } else {
    discountCalc = discount_amount
  }

  const afterDiscount = subtotal - discountCalc
  const tax_amount = Math.round(afterDiscount * (tax_rate / 100) * 100) / 100
  const total = afterDiscount + tax_amount

  const paidAmount = payments.reduce((sum: number, p: { amount: number }) => sum + p.amount, 0)
  let payment_status: POSPaymentStatus = 'pending'
  if (paidAmount >= total) payment_status = 'paid'
  else if (paidAmount > 0) payment_status = 'partial'

  // Fiş numarası: RCP-YYYY-XXXX
  const admin = createAdminClient()
  const year = new Date().getFullYear()
  const { count } = await admin
    .from('pos_transactions')
    .select('*', { count: 'exact', head: true })
    .eq('business_id', business_id)

  const receipt_number = `RCP-${year}-${String((count || 0) + 1).padStart(4, '0')}`

  let invoice_id: string | null = null
  if (payment_status === 'paid') {
    const invoiceItems: InvoiceItem[] = items.map((item: POSItem) => ({
      service_name: item.name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total: item.total,
      product_id: item.product_id,
      type: item.type,
    }))

    const { count: invCount } = await admin
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .eq('business_id', business_id)

    const invoiceNumber = `INV-${year}-${String((invCount || 0) + 1).padStart(4, '0')}`
    const primaryMethod = payments[0]?.method || 'cash'

    const { data: invoice } = await admin
      .from('invoices')
      .insert({
        business_id,
        customer_id: customer_id || null,
        appointment_id: appointment_id || null,
        invoice_number: invoiceNumber,
        items: invoiceItems,
        subtotal,
        tax_rate: tax_rate || 0,
        tax_amount,
        total,
        status: 'paid',
        payment_method: primaryMethod,
        paid_at: new Date().toISOString(),
        notes: notes || null,
      })
      .select('id')
      .single()

    if (invoice) {
      invoice_id = invoice.id

      for (const item of items as POSItem[]) {
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
              business_id,
              product_id: item.product_id,
              type: 'out',
              quantity: item.quantity,
              notes: `Kasa satışı ${receipt_number}`,
              created_by: user.id,
            })
          }
        }
      }
    }
  }

  // POS transaction kaydet
  const { data: transaction, error } = await admin
    .from('pos_transactions')
    .insert({
      business_id,
      invoice_id,
      appointment_id: appointment_id || null,
      customer_id: customer_id || null,
      staff_id: staff_id || null,
      transaction_type,
      items,
      subtotal,
      discount_amount: discountCalc,
      discount_type: discount_type || null,
      tax_amount,
      total,
      payments,
      payment_status,
      receipt_number,
      notes: notes || null,
    })
    .select('*, customers(name, phone), staff_members(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction })
}

// PATCH: İşlem güncelle
export async function PATCH(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id gerekli' }, { status: 400 })

  const body = await req.json()
  const updateObj: Record<string, unknown> = {}

  if (body.payment_status !== undefined) updateObj.payment_status = body.payment_status
  if (body.notes !== undefined) updateObj.notes = body.notes
  if (body.transaction_type !== undefined) updateObj.transaction_type = body.transaction_type

  if (Object.keys(updateObj).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Kullanıcının business_id'sini al ve işlemin sahipliğini doğrula
  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .single()

  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data, error } = await admin
    .from('pos_transactions')
    .update(updateObj)
    .eq('id', id)
    .eq('business_id', staff.business_id)
    .select('*, customers(name, phone), staff_members(name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ transaction: data })
}
