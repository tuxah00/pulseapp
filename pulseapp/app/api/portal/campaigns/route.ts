import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

/**
 * Müşterinin segment'ine uyan aktif kampanyaları döner.
 * segment_filter JSONB: { segments?: string[] } — boş ise tüm müşterilere açık.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  // Müşterinin segment bilgisi
  const { data: customer } = await admin
    .from('customers')
    .select('segment')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  const customerSegment: string = customer?.segment || 'regular'

  // Aktif kampanyaları getir
  const { data: campaigns } = await admin
    .from('campaigns')
    .select('id, name, description, segment_filter, message_template, status, scheduled_at, created_at')
    .eq('business_id', businessId)
    .in('status', ['scheduled', 'sending', 'completed'])
    .order('created_at', { ascending: false })
    .limit(20)

  // Segment filtrelemesi (client-side, JSONB parse)
  const matched = (campaigns || []).filter((c: any) => {
    const segments: string[] = c.segment_filter?.segments || []
    if (!segments.length) return true // filtre yoksa herkese açık
    return segments.includes(customerSegment)
  })

  return NextResponse.json({ campaigns: matched })
}
