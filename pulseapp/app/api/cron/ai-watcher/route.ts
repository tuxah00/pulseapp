import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'
import {
  handleNoShowEvents,
  handleOverdueInvoices,
  handleChurnedCustomers,
  handleRevenueAnomaly,
  handleSlotGaps,
} from '@/lib/ai/watcher/event-handlers'

const log = createLogger({ route: 'api/cron/ai-watcher' })

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let totalInsights = 0
  let failures = 0

  for (const biz of businesses ?? []) {
    // AI kapalıysa atla
    if ((biz as any).settings?.ai_preferences?.enabled === false) continue
    try {
      const [noShow, overdue, churned, anomaly, gaps] = await Promise.all([
        handleNoShowEvents(admin, biz.id),
        handleOverdueInvoices(admin, biz.id),
        handleChurnedCustomers(admin, biz.id),
        handleRevenueAnomaly(admin, biz.id),
        handleSlotGaps(admin, biz.id),
      ])
      const bizInsights = noShow + overdue + churned + anomaly + gaps
      totalInsights += bizInsights
      if (bizInsights > 0) {
        log.info({ businessId: biz.id, bizInsights }, '[ai-watcher] yeni insight üretildi')
      }
    } catch (err) {
      failures++
      log.error({ err, businessId: biz.id }, '[ai-watcher] business failed')
    }
  }

  return NextResponse.json({
    ok: true,
    total_businesses: businesses?.length ?? 0,
    new_insights: totalInsights,
    failures,
  })
}
