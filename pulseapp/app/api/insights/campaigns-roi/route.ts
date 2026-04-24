import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import type { CampaignItem } from '@/lib/insights/templates'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/campaigns-roi' })

/**
 * GET /api/insights/campaigns-roi?businessId=&days=30
 *
 * Kampanya başına ulaşım, dönüşüm ve attribute edilen ciroyu döner.
 * Attribution kolonu (`appointments.campaign_id`) henüz migration sırasında
 * eklenmediyse 0 revenue ile fallback çalışır — panel boşta değil "yeterli
 * veri yok" durumunu gösterir.
 */
const SMS_COST_PER_SEND = 0.3 // yaklaşık ₺ — MVP için sabit

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    const campaignsRes = await admin
      .from('campaigns')
      .select('id, name, stats, created_at, status')
      .eq('business_id', businessId)
      .gte('created_at', range.fromIso)
      .lte('created_at', range.toIso)
      .order('created_at', { ascending: false })

    if (campaignsRes.error) throw campaignsRes.error

    const rows = (campaignsRes.data ?? []) as Array<{
      id: string
      name: string
      stats: { total_recipients?: number; sent?: number; errors?: number } | null
      created_at: string
      status: string
    }>

    // Attribution kolonuna bağlı sorgu — kolon yoksa sessizce boşa düş.
    let attributionMap = new Map<string, { appointments: number; revenue: number }>()
    if (rows.length > 0) {
      const campaignIds = rows.map((r) => r.id)
      try {
        const attRes = await admin
          .from('appointments')
          .select('id, campaign_id, status')
          .in('campaign_id', campaignIds)
          .is('deleted_at', null)
          .in('status', ['completed', 'confirmed'])

        if (attRes.error) throw attRes.error

        const appointmentIds: string[] = []
        for (const apt of attRes.data ?? []) {
          const cid = (apt as { campaign_id?: string }).campaign_id
          if (!cid) continue
          const bucket = attributionMap.get(cid) ?? { appointments: 0, revenue: 0 }
          bucket.appointments += 1
          attributionMap.set(cid, bucket)
          appointmentIds.push(apt.id as string)
        }

        if (appointmentIds.length > 0) {
          const invRes = await admin
            .from('invoices')
            .select('appointment_id, paid_amount, total, status')
            .in('appointment_id', appointmentIds)
            .is('deleted_at', null)
            .in('status', ['paid', 'partial'])

          if (invRes.error) throw invRes.error

          // appointment_id → revenue eşlemesi → campaign_id'ye dağıt
          const aptRevenue = new Map<string, number>()
          for (const inv of invRes.data ?? []) {
            const aptId = inv.appointment_id as string | null
            if (!aptId) continue
            const amount = Number(inv.paid_amount ?? inv.total ?? 0)
            if (!Number.isFinite(amount) || amount <= 0) continue
            aptRevenue.set(aptId, (aptRevenue.get(aptId) ?? 0) + amount)
          }

          for (const apt of attRes.data ?? []) {
            const cid = (apt as { campaign_id?: string }).campaign_id
            if (!cid) continue
            const rev = aptRevenue.get(apt.id as string) ?? 0
            const bucket = attributionMap.get(cid)
            if (bucket) bucket.revenue += rev
          }
        }
      } catch (err) {
        // Kolon henüz migrate edilmedi → attribution 0 ile devam.
        log.warn({ err: String(err) }, 'campaign_id attribution unavailable')
        attributionMap = new Map()
      }
    }

    const campaigns: CampaignItem[] = rows.map((r) => {
      const stats = r.stats ?? {}
      const recipientCount = Number(stats.sent ?? stats.total_recipients ?? 0) || 0
      const att = attributionMap.get(r.id) ?? { appointments: 0, revenue: 0 }
      const conversionRate = recipientCount > 0 ? att.appointments / recipientCount : 0
      return {
        id: r.id,
        name: r.name,
        recipientCount,
        attributedAppointments: att.appointments,
        attributedRevenue: Math.round(att.revenue),
        estimatedCost: Math.round(recipientCount * SMS_COST_PER_SEND),
        conversionRate,
      }
    })

    const insight = generateInsight('campaign', { campaigns })
    const totals = campaigns.reduce(
      (s, c) => ({
        recipients: s.recipients + c.recipientCount,
        appointments: s.appointments + c.attributedAppointments,
        revenue: s.revenue + c.attributedRevenue,
        cost: s.cost + c.estimatedCost,
      }),
      { recipients: 0, appointments: 0, revenue: 0, cost: 0 }
    )

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals,
      campaigns,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'campaigns-roi error')
    return NextResponse.json(
      { error: 'Kampanya ROI hesaplanamadı' },
      { status: 500 },
    )
  }
}
