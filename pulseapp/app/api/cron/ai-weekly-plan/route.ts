import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'
import { getOpenAIClient, ASSISTANT_MODEL } from '@/lib/ai/openai-client'
import {
  computeKpi,
  computeMarginAnalysis,
  computeOperationalPulse,
  computeSeasonalTrend,
} from '@/lib/analytics/insights'
import { getSectorStrategyForPrompt } from '@/lib/ai/strategic-context'
import {
  createInsightIfNotDuplicate,
  type InsightSeverity,
  type InsightType,
} from '@/lib/ai/watcher/event-handlers'
import type { BusinessSettings, SectorType } from '@/types'

const log = createLogger({ route: 'api/cron/ai-weekly-plan' })

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

interface WeeklyPlanCard {
  type: Exclude<InsightType, 'automation_proposal'>
  severity: InsightSeverity
  title: string
  body: string
  action_label?: string
  action_href?: string
}

interface WeeklyPlanResponse {
  this_week_focus: string
  cards: WeeklyPlanCard[]
}

const MAX_BUSINESSES_PER_RUN = 50

/**
 * Pazartesi 07:00 — Her işletme için haftalık stratejik plan üretir.
 * Çıktı: ai_insights tablosuna 3-5 yüksek öncelikli kart.
 */
export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id, name, sector, settings')
    .eq('is_active', true)
    .limit(MAX_BUSINESSES_PER_RUN)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let totalCards = 0
  let failures = 0
  const hasOpenAI = !!process.env.OPENAI_API_KEY

  for (const biz of businesses ?? []) {
    // AI kapalıysa atla
    const settings = biz.settings as BusinessSettings | null
    if (settings?.ai_preferences?.enabled === false) continue

    try {
      const cardsCreated = await generatePlanForBusiness(
        admin,
        biz.id,
        biz.name,
        (biz.sector ?? 'other') as SectorType,
        hasOpenAI,
      )
      totalCards += cardsCreated
      if (cardsCreated > 0) {
        log.info({ businessId: biz.id, cardsCreated }, '[ai-weekly-plan] plan üretildi')
      }
    } catch (err) {
      failures++
      log.error({ err, businessId: biz.id }, '[ai-weekly-plan] business failed')
    }
  }

  return NextResponse.json({
    ok: true,
    total_businesses: businesses?.length ?? 0,
    new_cards: totalCards,
    failures,
  })
}

async function generatePlanForBusiness(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  businessName: string,
  sector: SectorType,
  hasOpenAI: boolean,
): Promise<number> {
  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourWeeksAgo = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const period = {
    from: fourWeeksAgo.toISOString().split('T')[0],
    to: now.toISOString().split('T')[0],
  }

  // Tüm veri toplama paralel — KPI + margin + pulse + seasonal + durumsal sayımlar
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const [margin, kpi, pulse, seasonal, waitlistRes, churnRes, campaignsRes] =
    await Promise.all([
      computeMarginAnalysis(admin, businessId, period),
      computeKpi(admin, businessId, period, sector),
      computeOperationalPulse(admin, businessId),
      computeSeasonalTrend(admin, businessId, sector),
      admin
        .from('waitlist')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', 'waiting'),
      admin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .not('last_visit_at', 'is', null)
        .lt('last_visit_at', ninetyDaysAgo),
      admin
        .from('campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .in('status', ['scheduled', 'running']),
    ])
  const waitlistCount = waitlistRes.count
  const churnRisk = churnRes.count
  const activeCampaigns = campaignsRes.count

  let plan: WeeklyPlanResponse
  if (hasOpenAI) {
    plan = await callOpenAIForPlan({
      businessName,
      sector,
      kpi,
      pulse,
      margin: margin.slice(0, 5),
      seasonal: seasonal.slice(-4),
      waitlistCount: waitlistCount ?? 0,
      churnRisk: churnRisk ?? 0,
      activeCampaigns: activeCampaigns ?? 0,
    })
  } else {
    plan = buildFallbackPlan({
      kpi,
      pulse,
      waitlistCount: waitlistCount ?? 0,
      churnRisk: churnRisk ?? 0,
    })
  }

  // ai_insights tablosuna yaz
  let created = 0
  const weekKey = `week_${weekAgo.toISOString().split('T')[0]}`

  // Ana odak kartı
  if (plan.this_week_focus) {
    const ok = await createInsightIfNotDuplicate(admin, {
      business_id: businessId,
      type: 'suggestion',
      severity: 'high',
      source_event_type: `weekly_plan_focus_${weekKey}`,
      title: 'Bu hafta odak noktası',
      body: plan.this_week_focus,
      suggested_action: {
        tool_name: 'get_strategic_recommendations',
        args: {},
        label: 'Stratejileri Gör',
        href: '/dashboard/analytics',
      },
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (ok) created++
  }

  // Kart bazlı insight'lar
  for (const [i, card] of plan.cards.slice(0, 5).entries()) {
    const ok = await createInsightIfNotDuplicate(admin, {
      business_id: businessId,
      type: card.type,
      severity: card.severity,
      source_event_type: `weekly_plan_${weekKey}_${i}`,
      title: card.title,
      body: card.body,
      suggested_action: card.action_label
        ? {
            tool_name: 'noop',
            args: {},
            label: card.action_label,
            href: card.action_href ?? '/dashboard',
          }
        : undefined,
      expires_at: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (ok) created++
  }

  return created
}

async function callOpenAIForPlan(ctx: {
  businessName: string
  sector: SectorType
  kpi: Awaited<ReturnType<typeof computeKpi>>
  pulse: Awaited<ReturnType<typeof computeOperationalPulse>>
  margin: Awaited<ReturnType<typeof computeMarginAnalysis>>
  seasonal: Awaited<ReturnType<typeof computeSeasonalTrend>>
  waitlistCount: number
  churnRisk: number
  activeCampaigns: number
}): Promise<WeeklyPlanResponse> {
  const openai = getOpenAIClient()

  const strategyBlock = getSectorStrategyForPrompt(ctx.sector)

  const prompt = `
İşletme: ${ctx.businessName} (sektör: ${ctx.sector})
Dönem: Son 4 hafta

${strategyBlock}

## Son 4 Hafta KPI'lar
- Kâr marjı: ${ctx.kpi.margin_percentage ?? 'N/A'}%
- Doluluk: ${ctx.kpi.occupancy_percentage ?? 'N/A'}%
- Müşteri tutma (90 gün): ${ctx.kpi.retention_percentage ?? 'N/A'}%
- En yoğun hizmet payı: ${ctx.kpi.service_concentration ?? 'N/A'}%
- Toplam ciro: ₺${ctx.kpi.total_revenue?.toLocaleString('tr-TR') ?? 0}
- Aktif müşteri: ${ctx.kpi.total_customers}

## Operasyonel Nabız
- Pik saat: ${ctx.pulse.peak_hour?.label ?? 'Bilinmiyor'}
- İptal/no-show oranı: ${ctx.pulse.cancellation_rate ?? 0}%
- Yeni/düzenli dağılım: ${ctx.pulse.new_vs_returning ? `${ctx.pulse.new_vs_returning.new_pct}% yeni` : 'N/A'}
- Haftalık ciro değişimi: ${ctx.pulse.weekly_revenue_delta ?? 0}%

## En Kârlı 5 Hizmet
${ctx.margin.map((m, i) => `${i + 1}. ${m.service_name} — ₺${m.revenue.toLocaleString('tr-TR')} (${m.quadrant}, pay: ${m.revenue_share}%)`).join('\n')}

## Durumsal Sinyaller
- Bekleme listesi: ${ctx.waitlistCount} kişi
- Risk müşteri (90+ gün gelmeyen): ${ctx.churnRisk}
- Aktif kampanya: ${ctx.activeCampaigns}

---

Bu bilgilerle bu hafta için stratejik plan çıkar. Yanıt SADECE şu JSON formatında:

{
  "this_week_focus": "Tek cümle — bu hafta ne üzerinde yoğunlaşılmalı (max 120 karakter)",
  "cards": [
    {
      "type": "opportunity" | "risk" | "suggestion",
      "severity": "info" | "normal" | "high" | "critical",
      "title": "Kısa başlık (max 60 karakter)",
      "body": "2-3 cümle somut öneri. Rakam ve spesifik aksiyon içermeli.",
      "action_label": "Buton metni (opsiyonel, max 20 karakter)",
      "action_href": "/dashboard/... (opsiyonel)"
    }
  ]
}

Kurallar:
- 3-5 kart üret (daha az değil, daha çok değil)
- Sektör stratejik bağlamındaki playbook'ları referans al
- Her kartta somut sayı/eşik kullan (örn. "%15 indirim", "5 müşteri")
- Türkçe, doğal, emir olmayan bir dil kullan
- Genel tavsiye VERME — spesifik ve bu işletmeye özel ol
`

  const completion = await openai.chat.completions.create({
    model: ASSISTANT_MODEL,
    max_tokens: 1200,
    temperature: 0.6,
    messages: [
      {
        role: 'system',
        content:
          'Sen bir iş stratejisi danışmanısın. İşletme verilerine bakıp haftalık stratejik plan üretirsin. Yanıtın YALNIZCA geçerli JSON olur, başka metin yazmazsın.',
      },
      { role: 'user', content: prompt },
    ],
    response_format: { type: 'json_object' },
  })

  const text = completion.choices[0]?.message?.content ?? ''
  try {
    const parsed = JSON.parse(text)
    return {
      this_week_focus: String(parsed.this_week_focus ?? ''),
      cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    }
  } catch (err) {
    log.error({ err, raw: text }, 'weekly-plan JSON parse hatası')
    return { this_week_focus: '', cards: [] }
  }
}

function buildFallbackPlan(ctx: {
  kpi: Awaited<ReturnType<typeof computeKpi>>
  pulse: Awaited<ReturnType<typeof computeOperationalPulse>>
  waitlistCount: number
  churnRisk: number
}): WeeklyPlanResponse {
  const cards: WeeklyPlanCard[] = []

  if (ctx.churnRisk > 5) {
    cards.push({
      type: 'risk',
      severity: 'high',
      title: `${ctx.churnRisk} müşteri 90+ gündür gelmiyor`,
      body: `Aktif müşteri tabanınızın önemli bir kısmı uzun süredir randevu almadı. Geri kazanım kampanyası başlatmak CLV'yi korur.`,
      action_label: 'Winback Başlat',
      action_href: '/dashboard/campaigns',
    })
  }

  if (ctx.waitlistCount > 0) {
    cards.push({
      type: 'opportunity',
      severity: 'normal',
      title: `${ctx.waitlistCount} kişi bekleme listesinde`,
      body: 'Bekleme listesindeki müşterilere uygun slot açıldığında otomatik teklif göndermek doluluk için avantaj sağlar.',
      action_label: 'Listeyi Gör',
      action_href: '/dashboard/waitlist',
    })
  }

  if (ctx.kpi.margin_percentage !== null && ctx.kpi.margin_percentage < 35) {
    cards.push({
      type: 'risk',
      severity: 'high',
      title: `Kâr marjı düşük: %${ctx.kpi.margin_percentage}`,
      body: 'Giderler geliri yakın takip ediyor. En kârsız hizmetleri ve gider kalemlerini gözden geçirmek önerilir.',
      action_label: 'Analitiğe Git',
      action_href: '/dashboard/analytics',
    })
  }

  return {
    this_week_focus:
      cards.length > 0
        ? 'Müşteri tutma ve doluluk üzerine yoğunlaş — aşağıdaki önerileri değerlendir.'
        : 'Veriler stabil — mevcut ritmi koru, yeni müşteri kazanım fırsatlarını ara.',
    cards,
  }
}
