import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

/**
 * GET /api/portal/messages/unread-count
 *
 * Müşteri için okunmamış outbound mesaj (salondan gelen) sayısı.
 * Sidebar nav'daki badge bu değeri gösterir.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { count, error } = await admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('direction', 'outbound')
    .eq('is_read', false)

  if (error) {
    return NextResponse.json({ error: 'count_failed', count: 0 }, { status: 500 })
  }

  return NextResponse.json({ count: count ?? 0 })
}
