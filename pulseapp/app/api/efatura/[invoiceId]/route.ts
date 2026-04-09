import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'
import { getInvoicePdf, cancelInvoice, isParasutConfigured } from '@/lib/efatura/parasut'

// GET: e-Fatura PDF URL'ini al
export async function GET(
  req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  if (!isParasutConfigured()) {
    return NextResponse.json({ error: 'Paraşüt yapılandırılmamış' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('efatura_id, efatura_pdf_url')
    .eq('id', params.invoiceId)
    .eq('business_id', businessId)
    .single()

  if (!invoice?.efatura_id) {
    return NextResponse.json({ error: 'Bu fatura için e-Fatura yok' }, { status: 404 })
  }

  // Önce DB'deki PDF URL'ini kontrol et
  if (invoice.efatura_pdf_url) {
    return NextResponse.json({ pdf_url: invoice.efatura_pdf_url })
  }

  // Paraşüt'ten al
  const pdfUrl = await getInvoicePdf(invoice.efatura_id)

  if (pdfUrl) {
    await admin
      .from('invoices')
      .update({ efatura_pdf_url: pdfUrl })
      .eq('id', params.invoiceId)
  }

  return NextResponse.json({ pdf_url: pdfUrl })
}

// DELETE: e-Fatura iptal et
export async function DELETE(
  req: NextRequest,
  { params }: { params: { invoiceId: string } }
) {
  const auth = await requirePermission(req, 'invoices')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  if (!isParasutConfigured()) {
    return NextResponse.json({ error: 'Paraşüt yapılandırılmamış' }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: invoice } = await admin
    .from('invoices')
    .select('efatura_id')
    .eq('id', params.invoiceId)
    .eq('business_id', businessId)
    .single()

  if (!invoice?.efatura_id) {
    return NextResponse.json({ error: 'Bu fatura için e-Fatura yok' }, { status: 404 })
  }

  try {
    await cancelInvoice(invoice.efatura_id)

    await admin
      .from('invoices')
      .update({
        efatura_status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', params.invoiceId)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'İptal hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
