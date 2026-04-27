import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint — businessId filtresi cross-tenant korumasını sağlar
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

/**
 * GET /api/public/business/[id]/packages
 *
 * İşletmenin satışta olan paket şablonlarını döner.
 * Public endpoint — auth gerektirmez.
 * Opsiyonel query param: ?serviceId=<uuid> → o hizmete ait paketleri filtreler.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const serviceId = new URL(req.url).searchParams.get('serviceId')
  if (serviceId && !isValidUUID(serviceId)) {
    return NextResponse.json({ error: 'Geçersiz serviceId' }, { status: 400 })
  }

  const admin = createAdminClient()

  let query = admin
    .from('service_packages')
    .select(`
      id, name, description, sessions_total, price, validity_days,
      service:services(id, name)
    `)
    .eq('business_id', params.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (serviceId) {
    query = query.eq('service_id', serviceId)
  }

  const { data, error } = await query
  if (error) {
    return NextResponse.json({ error: 'Paketler yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ packages: data || [] })
}
