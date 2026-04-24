import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

/**
 * GET /api/public/campaign-info?c=<campaign_recipient_id>&businessId=<uuid>
 *
 * Booking sayfası için kampanya adını ve açıklamasını döner.
 * Yalnızca recipient'in ait olduğu kampanya businessId ile eşleşirse
 * veri döner (cross-tenant koruması).
 *
 * Public endpoint; auth yok, RLS bypass için admin client.
 */
export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.general)
  if (rl.limited) return rl.response

  const recipientId = req.nextUrl.searchParams.get('c')
  const businessId = req.nextUrl.searchParams.get('businessId')

  if (!recipientId || !isValidUUID(recipientId)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }
  if (!businessId || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data: recipient } = await supabase
    .from('campaign_recipients')
    .select('id, campaigns!inner(id, name, description, business_id)')
    .eq('id', recipientId)
    .maybeSingle()

  if (!recipient) {
    return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 })
  }

  // Nested select: campaigns tek obje veya dizi olabilir
  const campaigns = recipient.campaigns as unknown
  const campaign = Array.isArray(campaigns)
    ? (campaigns as Array<{ id: string; name: string; description: string | null; business_id: string }>)[0]
    : (campaigns as { id: string; name: string; description: string | null; business_id: string } | null | undefined)

  if (!campaign || campaign.business_id !== businessId) {
    return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({
    name: campaign.name,
    description: campaign.description || null,
  })
}
