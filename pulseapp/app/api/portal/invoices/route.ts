import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('invoices')
    .select(`
      id, invoice_number, items, subtotal, tax_rate, tax_amount, total,
      paid_amount, status, payment_method, payment_type, installment_count,
      paid_at, due_date, notes, created_at
    `)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: 'Faturalar yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ invoices: data || [] })
}
