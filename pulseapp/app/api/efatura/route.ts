import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'
import { createSalesInvoice, isParasutConfigured } from '@/lib/efatura/parasut'
import type { InvoiceItem } from '@/types'

// POST: Fatura → e-Fatura (Paraşüt)
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  if (!isParasutConfigured()) {
    return NextResponse.json({
      error: 'Paraşüt entegrasyonu yapılandırılmamış. PARASUT_* env değişkenlerini ekleyin.',
      configured: false,
    }, { status: 503 })
  }

  const body = await req.json()
  const { invoiceId } = body

  if (!invoiceId) return NextResponse.json({ error: 'invoiceId zorunlu' }, { status: 400 })

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('*, customers(name, phone)')
    .eq('id', invoiceId)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single()

  if (!invoice) return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
  if (invoice.efatura_id) return NextResponse.json({ error: 'Bu fatura zaten e-Fatura gönderildi' }, { status: 409 })

  // Fatura kalemlerini Paraşüt formatına dönüştür
  const items = (invoice.items as InvoiceItem[]) || []
  const parasutItems = items.map(item => ({
    name: item.service_name || 'Hizmet',
    quantity: item.quantity || 1,
    unit_price: item.unit_price || item.total || 0,
    vat_rate: invoice.tax_rate || 20,
  }))

  if (parasutItems.length === 0) {
    parasutItems.push({
      name: 'Hizmet',
      quantity: 1,
      unit_price: invoice.total || 0,
      vat_rate: invoice.tax_rate || 20,
    })
  }

  const customer = Array.isArray(invoice.customers) ? invoice.customers[0] : invoice.customers

  try {
    const result = await createSalesInvoice({
      contact_name: customer?.name || 'Bilinmeyen Müşteri',
      issue_date: invoice.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      invoice_number: invoice.invoice_number,
      currency: 'TRY',
      items: parasutItems,
      notes: invoice.notes || undefined,
    })

    // Faturaya e-fatura bilgilerini kaydet
    await admin
      .from('invoices')
      .update({
        efatura_id: result.id,
        efatura_status: 'sent',
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoiceId)

    return NextResponse.json({ efatura: result })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'e-Fatura gönderimi başarısız'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// GET: e-Fatura durumu listesi (business için)
export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('invoices')
    .select('id, invoice_number, efatura_id, efatura_status, efatura_pdf_url, total, created_at, customers(name)')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .not('efatura_id', 'is', null)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ efaturalar: data })
}
