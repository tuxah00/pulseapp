import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { getOpenAIClient, ASSISTANT_MODEL } from '@/lib/ai/openai-client'
import { handleDetectAnomalies, handleDetectRiskCustomers } from '@/lib/ai/assistant-tools'
import { computeStrategicRecommendations } from '@/lib/analytics/insights'
import { getCurrentSeasonalContext } from '@/lib/ai/strategic-context'
import type { SectorType } from '@/types'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/ai-daily-brief' })

export const runtime = 'nodejs'
export const maxDuration = 60

const MS_PER_DAY = 24 * 60 * 60 * 1000
const BRIEF_MAX_TOKENS = 400

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id, name, sector, settings')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let briefs = 0
  let failures = 0

  for (const biz of businesses || []) {
    try {
      if ((biz as any).settings?.ai_preferences?.auto_brief_enabled === false) continue
      await generateAndStoreBrief(admin, biz.id, biz.name, (biz.sector as SectorType) || 'other')
      briefs += 1
    } catch (err) {
      failures += 1
      log.error({ err, businessId: biz.id }, '[ai-daily-brief] business failed')
    }
  }

  return NextResponse.json({ ok: true, briefs, failures, total: businesses?.length || 0 })
}

async function generateAndStoreBrief(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  businessName: string,
  sector: SectorType,
) {
  const today = new Date()
  const todayIso = today.toISOString().split('T')[0]
  const tomorrow = new Date(today.getTime() + MS_PER_DAY)
  const tomorrowIso = tomorrow.toISOString().split('T')[0]

  const [todayAptsRes, tomorrowAptsRes, pendingMsgsRes, unpaidInvRes, anomaliesRes, riskRes, strategicRecs] = await Promise.all([
    admin.from('appointments')
      .select('id, status, customers(name), services(name), start_time')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('appointment_date', todayIso),
    admin.from('appointments')
      .select('id')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('appointment_date', tomorrowIso),
    admin.from('messages')
      .select('id')
      .eq('business_id', businessId)
      .eq('direction', 'inbound')
      .eq('is_read', false)
      .limit(100),
    admin.from('invoices')
      .select('id, total, paid_amount')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .in('status', ['pending', 'partial', 'overdue'])
      .limit(100),
    handleDetectAnomalies(admin, businessId),
    handleDetectRiskCustomers(admin, businessId, { limit: 5 }),
    computeStrategicRecommendations(admin, businessId, sector).catch(err => {
      log.error({ err }, '[ai-daily-brief] strategic recs failed')
      return []
    }),
  ])

  const todayApts = todayAptsRes.data || []
  const tomorrowApts = tomorrowAptsRes.data || []
  const pendingMsgs = pendingMsgsRes.data || []
  const unpaidInv = unpaidInvRes.data || []
  const unpaidTotal = unpaidInv.reduce(
    (s: number, i: any) => s + Math.max(0, (i.total || 0) - (i.paid_amount || 0)),
    0,
  )

  const anomalies = anomaliesRes.success ? (anomaliesRes.data?.anomalies || []) : []
  const riskCustomers = riskRes.success ? (riskRes.data?.customers || []).slice(0, 5) : []

  // En yüksek severity tek stratejik öneri + yaklaşan mevsimsel peak
  const rank: Record<string, number> = { critical: 0, high: 1, medium: 2, info: 3 }
  const topRec = (strategicRecs || [])
    .slice()
    .sort((a, b) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9))[0] || null
  const seasonal = getCurrentSeasonalContext(sector, today)
  const upcomingPeak = seasonal.upcoming.find(u => u.demand === 'peak' || u.demand === 'high') || null

  const metrics = {
    today_appointments: todayApts.length,
    today_first: todayApts[0]
      ? { time: (todayApts[0] as any).start_time, customer: (todayApts[0] as any).customers?.name, service: (todayApts[0] as any).services?.name }
      : null,
    tomorrow_appointments: tomorrowApts.length,
    pending_messages: pendingMsgs.length,
    unpaid_invoices: unpaidInv.length,
    unpaid_total: Math.round(unpaidTotal * 100) / 100,
    anomalies,
    risk_customers_preview: riskCustomers.map((c: any) => ({ name: c.name, days: c.days_since_last_visit })),
    strategic_note: topRec ? {
      severity: topRec.severity,
      title: topRec.title,
      rationale: topRec.rationale,
    } : null,
    upcoming_season: upcomingPeak ? {
      label: upcomingPeak.label,
      demand: upcomingPeak.demand,
      note: upcomingPeak.note,
    } : null,
  }

  const brief = await generateBriefText(businessName, metrics)
  if (!brief) return

  const todayLabel = today.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  await admin.from('notifications').insert({
    business_id: businessId,
    type: 'ai_brief',
    title: `Günün Özeti — ${todayLabel}`,
    body: brief,
    is_read: false,
  })
}

async function generateBriefText(
  businessName: string,
  metrics: Record<string, any>,
): Promise<string | null> {
  try {
    const openai = getOpenAIClient()
    const res = await openai.chat.completions.create({
      model: ASSISTANT_MODEL,
      max_tokens: BRIEF_MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: `Sen ${businessName} işletmesinin sabah brief asistanısın. Aldığın metrikleri okuyup 3-5 kısa madde halinde Türkçe sabah özeti yaz. Sade, pratik, eylem odaklı ol. Gereksiz selamlama yapma, doğrudan maddelere geç. Anomali yoksa pozitif not ver. Emoji kullanma. Eğer metrikte strategic_note veya upcoming_season varsa son maddede "Stratejik not:" önekiyle kısa bir cümle halinde ekle — kâr/doluluk/mevsim fırsatını hatırlat.`,
        },
        {
          role: 'user',
          content: `Metrikler (JSON):\n${JSON.stringify(metrics, null, 2)}\n\nKısa özet hazırla.`,
        },
      ],
    })
    return res.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    log.error({ err }, '[ai-daily-brief] openai error')
    return null
  }
}
