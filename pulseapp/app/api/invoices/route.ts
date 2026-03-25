import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { InvoiceItem } from '@/types'

// GET: Fatura listesi
export async function GET(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const status = searchParams.get('status')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const admin = createAdminClient()
  let query = admin
    .from('invoices')
    .select('*, customers(name, phone)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') query = query.eq('status', status)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59Z')

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
  const { business_id, customer_id, appointment_id, items, tax_rate = 0, notes, due_date } = body

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
      status: 'pending',
      notes: notes || null,
      due_date: due_date || null,
    })
    .select('*, customers(name, phone)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
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

  const admin = createAdminClient()
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
        // Stok düş
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

          // Stok hareketi kaydet
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
