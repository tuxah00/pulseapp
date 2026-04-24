import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidUUID } from '@/lib/utils/validate'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

// POST — Müşteri ödülü "kullanmak istiyorum" diyerek personele bildirir.
// Talebi notifications üzerinden işler; personel paneli ödülü 'used' olarak işaretler.
// Idempotency: aynı ödül için son 30 dk içinde aynı talep varsa 409.
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const rl = checkRateLimit(request, RATE_LIMITS.general)
  if (rl.limited) return rl.response

  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: row, error } = await admin
    .from('customer_rewards')
    .select(`
      id, status, expires_at,
      reward:rewards(id, name, value, type),
      customer:customers(name)
    `)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (error || !row) {
    return NextResponse.json({ error: 'Ödül bulunamadı' }, { status: 404 })
  }
  if (row.status !== 'pending') {
    return NextResponse.json({ error: 'Bu ödül zaten kullanılmış veya geçersiz' }, { status: 409 })
  }
  if (row.expires_at && new Date(row.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Bu ödülün geçerlilik süresi dolmuş' }, { status: 409 })
  }

  // Idempotency: son 30 dakikada aynı reward için talep var mı?
  const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { count } = await admin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('type', 'reward_redemption_requested')
    .eq('related_id', row.id)
    .gte('created_at', cutoff)

  if ((count || 0) > 0) {
    return NextResponse.json({
      error: 'Bu ödül için kısa süre önce talep gönderdiniz. Personel onayını bekleyin.',
    }, { status: 409 })
  }

  const reward = row.reward as unknown as { name: string; value: number; type: string } | null
  const customer = row.customer as unknown as { name: string } | null

  await admin.from('notifications').insert({
    business_id: businessId,
    type: 'reward_redemption_requested',
    title: `Ödül talebi: ${customer?.name || 'Müşteri'}`,
    body: `${reward?.name || 'Ödül'} kullanmak istiyor. Onaylayınca ödül "kullanıldı" olarak işaretlenir.`,
    related_id: row.id,
    related_type: 'customer_reward',
  })

  return NextResponse.json({ success: true })
}
