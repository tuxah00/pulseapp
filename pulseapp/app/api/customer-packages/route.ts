import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/customer-packages' })

/**
 * POST /api/customer-packages
 * POS'tan paket satışı sonrası çağrılır: customer_packages tablosuna satır ekler.
 * Body: {
 *   business_id, package_id, customer_id, package_name,
 *   service_id?, sessions_total, price_paid, staff_id?, invoice_id?, notes?
 * }
 */
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'pos')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createServerSupabaseClient()
  const body = await req.json().catch(() => null) as Record<string, any> | null
  if (!body) return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })

  const customerId = typeof body.customer_id === 'string' ? body.customer_id : null
  const packageId = typeof body.package_id === 'string' ? body.package_id : null
  const serviceId = typeof body.service_id === 'string' ? body.service_id : null
  const staffId = typeof body.staff_id === 'string' ? body.staff_id : null
  const invoiceId = typeof body.invoice_id === 'string' ? body.invoice_id : null
  const packageName: string = body.package_name || 'Paket'
  const sessionsTotal: number = Number(body.sessions_total) || 1
  const pricePaid: number = Number(body.price_paid) || 0
  const notes: string | null = typeof body.notes === 'string' ? body.notes : null

  if (!customerId) {
    return NextResponse.json({ error: 'customer_id gerekli' }, { status: 400 })
  }

  // Müşteri ve paketin bu işletmeye ait olduğunu doğrula
  const { data: cust } = await supabase
    .from('customers')
    .select('id, name, phone')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .maybeSingle()
  if (!cust) return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })

  if (packageId) {
    const { data: pkg } = await supabase
      .from('service_packages')
      .select('id')
      .eq('id', packageId)
      .eq('business_id', businessId)
      .maybeSingle()
    if (!pkg) return NextResponse.json({ error: 'Paket bulunamadı' }, { status: 404 })
  }

  const insertPayload: Record<string, unknown> = {
    business_id: businessId,
    package_id: packageId,
    customer_id: customerId,
    customer_name: cust.name,
    customer_phone: cust.phone,
    package_name: packageName,
    service_id: serviceId,
    sessions_total: sessionsTotal,
    sessions_used: 0,
    price_paid: pricePaid,
    status: 'active',
    staff_id: staffId,
    invoice_id: invoiceId,
    notes,
  }

  const { data, error } = await supabase
    .from('customer_packages')
    .insert(insertPayload)
    .select()
    .single()

  if (error) {
    log.error({ err: error }, '[customer-packages] insert error')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ customer_package: data })
}
