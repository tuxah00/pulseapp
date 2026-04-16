import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidUUID } from '@/lib/utils/validate'

const INVOICE_COLUMNS =
  'id, invoice_number, items, subtotal, tax_rate, tax_amount, total, paid_amount, status, payment_method, payment_type, installment_count, paid_at, due_date, notes, created_at'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: invoice } = await admin
    .from('invoices')
    .select(INVOICE_COLUMNS)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .single()

  if (!invoice) {
    return NextResponse.json({ error: 'Fatura bulunamadı' }, { status: 404 })
  }

  const [{ data: payments }, { data: business }] = await Promise.all([
    admin
      .from('invoice_payments')
      .select('id, amount, method, payment_type, installment_number, notes, created_at')
      .eq('invoice_id', params.id)
      .eq('business_id', businessId)
      .order('created_at', { ascending: true }),
    admin
      .from('businesses')
      .select('id, name, phone, address, city, district, settings')
      .eq('id', businessId)
      .single(),
  ])

  return NextResponse.json({
    invoice,
    payments: payments || [],
    business,
  })
}
