import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import {
  computeSegmentDistribution,
  computeRiskGrowthRatio,
  computeVipShareOfRevenue,
  type SegmentInputCustomer,
} from '@/lib/segments/compute'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/customer-mix' })

/**
 * GET /api/insights/customer-mix?businessId=&days=30
 *
 * 5 segment (new/regular/vip/risk/lost) dağılımı + waitlist dolum sayısı.
 * Risk büyüme oranı ve VIP ciro payı template motoru için ek context üretir.
 *
 * Waitlist dolumu için `waitlist_entries.filled_appointment_id` kolonu
 * migration 068 ile eklendi; kolon henüz uygulanmadıysa null-safe fallback.
 */
const DAY = 24 * 60 * 60 * 1000

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    // Segment hesabı tüm aktif müşteri tabanına bakar (range'e bağlı değil)
    const customersRes = await admin
      .from('customers')
      .select('id, created_at, last_visit_at, total_visits, total_revenue, no_show_score')
      .eq('business_id', businessId)

    if (customersRes.error) throw customersRes.error

    const customers: SegmentInputCustomer[] = (customersRes.data ?? []).map((c) => ({
      id: c.id as string,
      created_at: c.created_at as string,
      last_visit_at: (c.last_visit_at as string | null) ?? null,
      total_visits: Number(c.total_visits ?? 0),
      total_revenue: Number(c.total_revenue ?? 0),
      no_show_score: (c.no_show_score as number | null) ?? null,
    }))

    const { distribution, total } = computeSegmentDistribution(customers)
    const riskGrowthRatio = computeRiskGrowthRatio(customers)
    const vipShareOfRevenue = computeVipShareOfRevenue(customers)

    // Waitlist: 90 gün pencere + son 30 gün dolum sayısı
    const now = new Date()
    const since90 = new Date(now.getTime() - 90 * DAY).toISOString()
    const since30 = new Date(now.getTime() - 30 * DAY).toISOString()

    let activeEntries = 0
    let totalWaitlistLast90Days = 0
    let filledLast30Days = 0

    try {
      const waitlistRes = await admin
        .from('waitlist_entries')
        .select('id, is_active, created_at, filled_appointment_id, filled_at')
        .eq('business_id', businessId)
        .gte('created_at', since90)

      if (waitlistRes.error) throw waitlistRes.error
      const rows = waitlistRes.data ?? []
      totalWaitlistLast90Days = rows.length
      activeEntries = rows.filter((r) => r.is_active === true).length
      filledLast30Days = rows.filter((r) => {
        const filledAt = (r as { filled_at?: string | null }).filled_at
        return filledAt && filledAt >= since30
      }).length
    } catch (err) {
      // filled_appointment_id/filled_at henüz migrate edilmediyse kolon
      // seçilemez — fallback: yalnızca is_active ile aktif sayımı yap.
      log.warn({ err: String(err) }, 'waitlist filled columns unavailable')
      try {
        const fallbackRes = await admin
          .from('waitlist_entries')
          .select('id, is_active, created_at')
          .eq('business_id', businessId)
          .gte('created_at', since90)
        if (!fallbackRes.error) {
          const rows = fallbackRes.data ?? []
          totalWaitlistLast90Days = rows.length
          activeEntries = rows.filter((r) => r.is_active === true).length
        }
      } catch {
        // tablo hiç yoksa 0 ile geç
      }
    }

    const waitlistConversionRate =
      totalWaitlistLast90Days > 0 ? filledLast30Days / totalWaitlistLast90Days : 0

    const segmentInsight = generateInsight('segment', {
      distribution,
      total,
      riskGrowthRatio,
      vipShareOfRevenue,
    })
    const waitlistInsight = generateInsight('waitlist', {
      activeEntries,
      filledLast30Days,
      totalWaitlistLast90Days,
      conversionRate: waitlistConversionRate,
    })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      distribution,
      totals: {
        customers: total,
        riskGrowthRatio,
        vipShareOfRevenue,
      },
      waitlist: {
        activeEntries,
        filledLast30Days,
        totalWaitlistLast90Days,
        conversionRate: waitlistConversionRate,
      },
      segmentInsight,
      waitlistInsight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'customer-mix error')
    return NextResponse.json(
      { error: 'Müşteri dağılımı hesaplanamadı' },
      { status: 500 },
    )
  }
}
