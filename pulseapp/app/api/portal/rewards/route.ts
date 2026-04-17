import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  const [rewardsRes, loyaltyRes, txRes] = await Promise.all([
    admin
      .from('customer_rewards')
      .select(`
        id, status, given_at, used_at, expires_at, notes,
        reward:rewards(id, name, type, value, description, valid_days)
      `)
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('given_at', { ascending: false }),
    admin
      .from('loyalty_points')
      .select('points_balance, tier, total_earned, total_spent')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .maybeSingle(),
    admin
      .from('point_transactions')
      .select('id, type, points, source, description, created_at')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(15),
  ])

  return NextResponse.json({
    rewards: rewardsRes.data || [],
    loyalty: loyaltyRes.data || { points_balance: 0, tier: 'bronze', total_earned: 0, total_spent: 0 },
    transactions: txRes.data || [],
  })
}
