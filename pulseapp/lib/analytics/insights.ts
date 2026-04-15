import type { SectorType } from '@/types'
import type { createAdminClient } from '@/lib/supabase/admin'
import {
  SECTOR_STRATEGY,
  getCurrentSeasonalContext,
  DEMAND_LABELS_TR,
} from '@/lib/ai/strategic-context'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

export type Quadrant = 'star' | 'cash_cow' | 'question' | 'dog'

export interface ServiceMarginRow {
  service_name: string
  revenue: number
  appointment_count: number
  avg_ticket: number
  revenue_share: number
  quadrant: Quadrant
}

export interface MonthlyRevenuePoint {
  month: string // YYYY-MM
  label: string // "Oca 2026"
  revenue: number
  yoy_delta: number | null // % vs same month previous year
  demand: 'low' | 'normal' | 'high' | 'peak'
  demand_note: string
}

export interface CohortCell {
  cohort_month: string // YYYY-MM (first-visit month)
  cohort_size: number
  retention: { month_offset: number; returning: number; rate: number }[]
}

export interface InsightKpi {
  margin_percentage: number | null
  occupancy_percentage: number | null
  retention_percentage: number | null
  service_concentration: number | null // top service % of revenue
  total_revenue: number
  total_customers: number
}

export type RecommendationSeverity = 'critical' | 'high' | 'medium' | 'info'

export interface Recommendation {
  id: string
  severity: RecommendationSeverity
  focus: 'profit' | 'retention' | 'occupancy' | 'seasonal' | 'risk'
  title: string
  rationale: string
  evidence: string[]
  suggested_action?: {
    type: 'create_campaign' | 'send_message' | 'create_workflow' | 'update_service' | 'create_blocked_slot' | 'none'
    label: string
    payload?: Record<string, any>
  }
}

export interface InsightsSummary {
  sector: SectorType
  period: { from: string; to: string }
  kpi: InsightKpi
  margin: ServiceMarginRow[]
  seasonal: {
    monthly: MonthlyRevenuePoint[]
    current_context: {
      current_label: string
      current_demand: string
      current_note: string
      upcoming: { label: string; demand: string; note: string }[]
    }
  }
  cohort: CohortCell[]
  recommendations: Recommendation[]
}


const MONTH_LABELS_SHORT = [
  'Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz',
  'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara',
]

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function ymLabel(ym: string): string {
  const [y, m] = ym.split('-')
  return `${MONTH_LABELS_SHORT[Number(m) - 1]} ${y}`
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function paidAmount(inv: any): number {
  const paid = Number(inv.paid_amount ?? 0)
  if (paid > 0) return paid
  return Number(inv.total ?? 0)
}

const PAID_STATUSES = ['paid', 'partial']


export interface InsightsPeriod {
  from: string // YYYY-MM-DD
  to: string
}

export async function computeMarginAnalysis(
  admin: SupabaseAdmin,
  businessId: string,
  period: InsightsPeriod,
): Promise<ServiceMarginRow[]> {
  const { data: invoices } = await admin
    .from('invoices')
    .select('id, total, paid_amount, status, items, created_at')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .in('status', PAID_STATUSES)
    .gte('created_at', period.from)
    .lte('created_at', period.to + 'T23:59:59')

  if (!invoices || invoices.length === 0) return []

  const bucket = new Map<string, { revenue: number; count: number }>()
  let totalRevenue = 0

  for (const inv of invoices as any[]) {
    const items = (inv.items || []) as { service_name?: string; total?: number; quantity?: number }[]
    for (const item of items) {
      const key = item.service_name || 'Diğer'
      const rev = Number(item.total ?? 0)
      const cur = bucket.get(key) || { revenue: 0, count: 0 }
      cur.revenue += rev
      cur.count += Number(item.quantity ?? 1)
      bucket.set(key, cur)
      totalRevenue += rev
    }
  }

  if (totalRevenue <= 0) return []

  const rows = Array.from(bucket.entries()).map(([name, d]) => {
    const avg = d.count > 0 ? d.revenue / d.count : 0
    return {
      service_name: name,
      revenue: round2(d.revenue),
      appointment_count: d.count,
      avg_ticket: round2(avg),
      revenue_share: round1((d.revenue / totalRevenue) * 100),
      quadrant: 'dog' as Quadrant,
    }
  })

  // Quadrant: median revenue × median avg_ticket
  const sortedByRev = [...rows].map(r => r.revenue).sort((a, b) => a - b)
  const sortedByTicket = [...rows].map(r => r.avg_ticket).sort((a, b) => a - b)
  const medianRev = sortedByRev[Math.floor(sortedByRev.length / 2)] ?? 0
  const medianTicket = sortedByTicket[Math.floor(sortedByTicket.length / 2)] ?? 0

  for (const r of rows) {
    const highRev = r.revenue >= medianRev
    const highTicket = r.avg_ticket >= medianTicket
    if (highRev && highTicket) r.quadrant = 'star'
    else if (highRev && !highTicket) r.quadrant = 'cash_cow'
    else if (!highRev && highTicket) r.quadrant = 'question'
    else r.quadrant = 'dog'
  }

  return rows.sort((a, b) => b.revenue - a.revenue)
}


export async function computeSeasonalTrend(
  admin: SupabaseAdmin,
  businessId: string,
  sector: SectorType,
): Promise<MonthlyRevenuePoint[]> {
  // Son 24 ay — YoY için 12 ay öncesi gerekli
  const now = new Date()
  const start = new Date(now.getFullYear() - 2, now.getMonth(), 1)

  const { data: invoices } = await admin
    .from('invoices')
    .select('paid_amount, total, created_at, status')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .in('status', PAID_STATUSES)
    .gte('created_at', start.toISOString())

  const bucket = new Map<string, number>()
  for (const inv of (invoices || []) as any[]) {
    const d = new Date(inv.created_at)
    const key = ymKey(d)
    bucket.set(key, (bucket.get(key) || 0) + paidAmount(inv))
  }

  const strategy = SECTOR_STRATEGY[sector] ?? SECTOR_STRATEGY.other
  const monthly: MonthlyRevenuePoint[] = []

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = ymKey(d)
    const prev = new Date(d.getFullYear() - 1, d.getMonth(), 1)
    const prevKey = ymKey(prev)
    const current = bucket.get(key) || 0
    const previous = bucket.get(prevKey) || 0
    const yoy = previous > 0 ? round1(((current - previous) / previous) * 100) : null
    const seasonal = strategy.seasonal[d.getMonth()]
    monthly.push({
      month: key,
      label: ymLabel(key),
      revenue: round2(current),
      yoy_delta: yoy,
      demand: seasonal.demand,
      demand_note: seasonal.note,
    })
  }

  return monthly
}


export async function computeCohortRetention(
  admin: SupabaseAdmin,
  businessId: string,
  opts: { cohortMonths?: number } = {},
): Promise<CohortCell[]> {
  const cohortMonths = opts.cohortMonths ?? 6
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - cohortMonths + 1, 1)

  // Son N ay içinde kazanılan müşteriler
  const { data: customers } = await admin
    .from('customers')
    .select('id, created_at')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .gte('created_at', start.toISOString())

  if (!customers || customers.length === 0) return []

  const customerIds = customers.map((c: any) => c.id)
  const cohortMap = new Map<string, string[]>() // cohort_month → customerIds[]
  const firstDate = new Map<string, Date>() // customerId → first visit date

  for (const c of customers as any[]) {
    const d = new Date(c.created_at)
    const key = ymKey(d)
    const arr = cohortMap.get(key) || []
    arr.push(c.id)
    cohortMap.set(key, arr)
    firstDate.set(c.id, d)
  }

  // Randevular (soft-delete'siz) — kohort müşterileri için
  const { data: appointments } = await admin
    .from('appointments')
    .select('customer_id, appointment_date, status')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .in('customer_id', customerIds)
    .gte('appointment_date', start.toISOString().slice(0, 10))

  const aptByCustomer = new Map<string, Date[]>()
  for (const a of (appointments || []) as any[]) {
    if (a.status === 'cancelled' || a.status === 'no_show') continue
    const arr = aptByCustomer.get(a.customer_id) || []
    arr.push(new Date(a.appointment_date))
    aptByCustomer.set(a.customer_id, arr)
  }

  // Kohort başına retention matrisi
  const cells: CohortCell[] = []
  const sortedKeys = Array.from(cohortMap.keys()).sort()

  for (const cohortKey of sortedKeys) {
    const ids = cohortMap.get(cohortKey)!
    const retention: CohortCell['retention'] = []
    const [y, m] = cohortKey.split('-').map(Number)
    const cohortStart = new Date(y, m - 1, 1)

    for (let offset = 1; offset <= 5; offset++) {
      const periodStart = new Date(y, m - 1 + offset, 1)
      const periodEnd = new Date(y, m + offset, 1)
      if (periodStart > now) break

      let returning = 0
      for (const id of ids) {
        const visits = aptByCustomer.get(id) || []
        if (visits.some(v => v >= periodStart && v < periodEnd)) returning++
      }

      retention.push({
        month_offset: offset,
        returning,
        rate: ids.length > 0 ? round1((returning / ids.length) * 100) : 0,
      })
    }

    cells.push({
      cohort_month: cohortKey,
      cohort_size: ids.length,
      retention,
    })
  }

  return cells
}


export async function computeKpi(
  admin: SupabaseAdmin,
  businessId: string,
  period: InsightsPeriod,
  sector: SectorType,
  precomputedMargin?: ServiceMarginRow[],
): Promise<InsightKpi> {
  const [invResult, custResult, aptResult, expResult] = await Promise.all([
    admin
      .from('invoices')
      .select('total, paid_amount, status, created_at')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .in('status', PAID_STATUSES)
      .gte('created_at', period.from)
      .lte('created_at', period.to + 'T23:59:59'),
    admin
      .from('customers')
      .select('id, created_at, last_visit_at, is_active')
      .eq('business_id', businessId)
      .eq('is_active', true),
    admin
      .from('appointments')
      .select('id, appointment_date, start_time, end_time, status')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .gte('appointment_date', period.from)
      .lte('appointment_date', period.to),
    admin
      .from('expenses')
      .select('amount, expense_date')
      .eq('business_id', businessId)
      .gte('expense_date', period.from)
      .lte('expense_date', period.to),
  ])

  const invoices = (invResult.data || []) as any[]
  const totalRevenue = invoices.reduce((s, inv) => s + paidAmount(inv), 0)

  const expenses = (expResult.data || []) as any[]
  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount || 0), 0)
  const marginPct = totalRevenue > 0
    ? round1(((totalRevenue - totalExpenses) / totalRevenue) * 100)
    : null

  // Doluluk (basit tahmin — 9 saat × iş günü sayısı × personel sayısı kabaca)
  const apts = (aptResult.data || []) as any[]
  let bookedMinutes = 0
  for (const apt of apts) {
    if (apt.status === 'cancelled') continue
    if (apt.start_time && apt.end_time) {
      const [sh, sm] = apt.start_time.split(':').map(Number)
      const [eh, em] = apt.end_time.split(':').map(Number)
      const dur = (eh * 60 + em) - (sh * 60 + sm)
      bookedMinutes += dur > 0 ? dur : 30
    } else {
      bookedMinutes += 30
    }
  }
  const fromDate = new Date(period.from)
  const toDate = new Date(period.to)
  const days = Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / (24 * 60 * 60 * 1000)) + 1)
  const availableMinutes = days * 9 * 60 // tek "koltuk" baseline
  const occupancyPct = availableMinutes > 0
    ? Math.min(100, round1((bookedMinutes / availableMinutes) * 100))
    : null

  // Retention — 90 gün içinde son ziyaret
  const customers = (custResult.data || []) as any[]
  const now = Date.now()
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000
  const activeRecent = customers.filter(c => {
    if (!c.last_visit_at) return false
    return new Date(c.last_visit_at).getTime() >= ninetyDaysAgo
  }).length
  const retentionPct = customers.length > 0
    ? round1((activeRecent / customers.length) * 100)
    : null

  const margin = precomputedMargin ?? await computeMarginAnalysis(admin, businessId, period)
  const topShare = margin.length > 0 ? margin[0].revenue_share : null

  return {
    margin_percentage: marginPct,
    occupancy_percentage: occupancyPct,
    retention_percentage: retentionPct,
    service_concentration: topShare,
    total_revenue: round2(totalRevenue),
    total_customers: customers.length,
  }
}


export async function computeStrategicRecommendations(
  admin: SupabaseAdmin,
  businessId: string,
  sector: SectorType,
  opts: { focus?: Recommendation['focus']; precomputedKpi?: InsightKpi; precomputedMargin?: ServiceMarginRow[] } = {},
): Promise<Recommendation[]> {
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
  const today = now.toISOString().slice(0, 10)
  const period: InsightsPeriod = { from: monthStart, to: today }

  const margin = opts.precomputedMargin ?? await computeMarginAnalysis(admin, businessId, period)
  const kpi = opts.precomputedKpi ?? await computeKpi(admin, businessId, period, sector, margin)
  const strategy = SECTOR_STRATEGY[sector] ?? SECTOR_STRATEGY.other
  const seasonal = getCurrentSeasonalContext(sector, now)

  const recs: Recommendation[] = []

  // 1. Mevsim: peak yaklaşıyor (önümüzdeki 2 ayda)
  const peakUpcoming = seasonal.upcoming.find(u => u.demand === 'peak' || u.demand === 'high')
  if (peakUpcoming) {
    const relevantPlaybook = strategy.playbooks.find(p => p.trigger.toLowerCase().includes(peakUpcoming.label.toLowerCase()))
      || strategy.playbooks[0]
    recs.push({
      id: 'seasonal_upcoming',
      severity: peakUpcoming.demand === 'peak' ? 'high' : 'medium',
      focus: 'seasonal',
      title: `${peakUpcoming.label} talep ${peakUpcoming.demand === 'peak' ? 'zirvesi' : 'artışı'} yaklaşıyor`,
      rationale: peakUpcoming.note,
      evidence: [
        `Sektörel kalıp: ${peakUpcoming.label} → ${peakUpcoming.demand === 'peak' ? 'peak' : 'high'}`,
        relevantPlaybook ? `Playbook: ${relevantPlaybook.action}` : 'Sezonluk kampanya planla',
      ],
      suggested_action: relevantPlaybook
        ? {
            type: 'create_campaign',
            label: `"${relevantPlaybook.action}" kampanyasını hazırla`,
            payload: {
              name: `${peakUpcoming.label} Sezon Kampanyası`,
              message_template: `${relevantPlaybook.action} — ${peakUpcoming.label} için hazırlık.`,
              segment_filter: { segment: ['regular', 'vip'] },
            },
          }
        : { type: 'none', label: 'Stratejik plan yap' },
    })
  }

  // 2. Doluluk düşük
  if (kpi.occupancy_percentage != null && kpi.occupancy_percentage < 50) {
    const playbook = strategy.playbooks.find(p => p.trigger.toLowerCase().includes('boş'))
      || strategy.playbooks[strategy.playbooks.length - 1]
    recs.push({
      id: 'low_occupancy',
      severity: kpi.occupancy_percentage < 35 ? 'critical' : 'high',
      focus: 'occupancy',
      title: `Doluluk oranı düşük (%${kpi.occupancy_percentage})`,
      rationale: `Hedef doluluk ${strategy.kpi_targets.find(k => k.metric.toLowerCase().includes('doluluk'))?.target || '%65+'} seviyesinde olmalı. Şu an altında.`,
      evidence: [
        `Bu ay doluluk: %${kpi.occupancy_percentage}`,
        playbook ? `Playbook: ${playbook.action}` : 'Boş slot promosyonu',
      ],
      suggested_action: playbook
        ? {
            type: 'create_campaign',
            label: `"${playbook.action}" — boş slotları doldur`,
            payload: {
              name: 'Boş Slot Kampanyası',
              message_template: playbook.action,
            },
          }
        : { type: 'none', label: 'Boş slotları doldurmak için plan yap' },
    })
  }

  // 3. Hizmet konsantrasyon riski
  if (kpi.service_concentration != null && kpi.service_concentration > 50 && margin.length > 1) {
    const top = margin[0]
    recs.push({
      id: 'service_concentration',
      severity: kpi.service_concentration > 65 ? 'high' : 'medium',
      focus: 'profit',
      title: `"${top.service_name}" gelirin %${kpi.service_concentration}'ini oluşturuyor`,
      rationale: 'Tek hizmete aşırı bağımlılık riskli. Trend değişirse ciro ani düşebilir.',
      evidence: [
        `Top hizmet: ${top.service_name} — ${top.revenue.toLocaleString('tr-TR')}₺`,
        `İkinci hizmet: ${margin[1]?.service_name || '—'} — ${margin[1]?.revenue.toLocaleString('tr-TR') || 0}₺`,
        strategy.profit_drivers[0] || 'Hizmet çeşitlendirmesi öneriliyor',
      ],
      suggested_action: {
        type: 'none',
        label: 'Hizmet karmasını çeşitlendirmeyi değerlendir',
      },
    })
  }

  // 4. Kâr marjı hedef altında
  if (kpi.margin_percentage != null) {
    const marginTarget = strategy.kpi_targets.find(k => k.metric.toLowerCase().includes('marj'))
    const targetMatch = marginTarget?.target.match(/%(\d+)/)
    const targetLow = targetMatch ? Number(targetMatch[1]) : 40
    if (kpi.margin_percentage < targetLow) {
      recs.push({
        id: 'margin_below_target',
        severity: kpi.margin_percentage < targetLow - 15 ? 'critical' : 'high',
        focus: 'profit',
        title: `Kâr marjı hedefin altında (%${kpi.margin_percentage})`,
        rationale: `Sektör hedefi: ${marginTarget?.target || '%40-50'}. ${marginTarget?.why || 'Sağlıklı büyüme için marj gerekli.'}`,
        evidence: [
          `Mevcut marj: %${kpi.margin_percentage}`,
          `Hedef: ${marginTarget?.target || '%40-50'}`,
          strategy.margin_leaks[0] || 'Gider kategorilerini gözden geçir',
        ],
        suggested_action: { type: 'none', label: 'Gider analizini asistana sor' },
      })
    }
  }

  // 5. Retention düşük
  if (kpi.retention_percentage != null && kpi.retention_percentage < 40) {
    const hook = strategy.retention_hooks[0] || 'Otomatik takip mesajı'
    recs.push({
      id: 'low_retention',
      severity: kpi.retention_percentage < 25 ? 'high' : 'medium',
      focus: 'retention',
      title: `90 gün içinde dönen müşteri oranı düşük (%${kpi.retention_percentage})`,
      rationale: 'Yeni müşteri kazanmak mevcudu elde tutmaktan 5x pahalı.',
      evidence: [
        `Aktif (son 90 gün): %${kpi.retention_percentage}`,
        `Öneri: ${hook}`,
      ],
      suggested_action: {
        type: 'create_workflow',
        label: 'Otomatik winback akışı kur',
        payload: {
          name: 'Winback 60 Gün',
          trigger_type: 'customer_inactive',
          trigger_config: { days_inactive: 60 },
          steps: [
            { type: 'send_message', template: `Merhaba {name}, uzun zamandır görüşemedik. Özel bir teklif hazırladık.` },
          ],
        },
      },
    })
  }

  // 6. Risk altı müşteri kontrolü — yüksek CLV ama uzun süredir gelmemiş
  const { data: riskCustomers } = await admin
    .from('customers')
    .select('id, name, total_revenue, last_visit_at, segment')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('last_visit_at', 'is', null)
    .gte('total_revenue', 1000)
    .order('total_revenue', { ascending: false })
    .limit(20)

  const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
  const atRisk = (riskCustomers || []).filter((c: any) => {
    const last = new Date(c.last_visit_at).getTime()
    return last < sixtyDaysAgo
  })

  if (atRisk.length >= 3) {
    recs.push({
      id: 'vip_at_risk',
      severity: atRisk.length >= 10 ? 'high' : 'medium',
      focus: 'risk',
      title: `${atRisk.length} yüksek değerli müşteri 60+ gündür gelmedi`,
      rationale: 'VIP/regular müşteri kaybı ciroyu doğrudan etkiler.',
      evidence: atRisk.slice(0, 3).map((c: any) =>
        `${c.name} — ${Number(c.total_revenue).toLocaleString('tr-TR')}₺ harcamış, son ziyaret ${Math.round((Date.now() - new Date(c.last_visit_at).getTime()) / (24 * 60 * 60 * 1000))} gün önce`,
      ),
      suggested_action: {
        type: 'create_campaign',
        label: 'VIP winback kampanyası hazırla',
        payload: {
          name: 'VIP Geri Kazanım',
          message_template: `Merhaba {name}, özel indirimimiz sizin için hazır. Bir kahve içmeye bekleriz.`,
          segment_filter: { segment: ['vip', 'regular'], last_visit_days_ago: 60 },
        },
      },
    })
  }

  // Odak filtresi
  let filtered = recs
  if (opts.focus) {
    filtered = recs.filter(r => r.focus === opts.focus)
    if (filtered.length === 0) filtered = recs
  }

  // Severity sıralaması
  const severityOrder: Record<RecommendationSeverity, number> = {
    critical: 0, high: 1, medium: 2, info: 3,
  }
  filtered.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return filtered
}


export async function computeInsightsSummary(
  admin: SupabaseAdmin,
  businessId: string,
  sector: SectorType,
  period: InsightsPeriod,
): Promise<InsightsSummary> {
  const [margin, monthly, cohort] = await Promise.all([
    computeMarginAnalysis(admin, businessId, period),
    computeSeasonalTrend(admin, businessId, sector),
    computeCohortRetention(admin, businessId, { cohortMonths: 6 }),
  ])
  const kpi = await computeKpi(admin, businessId, period, sector, margin)
  const recommendations = await computeStrategicRecommendations(
    admin, businessId, sector,
    { precomputedKpi: kpi, precomputedMargin: margin },
  )

  const ctx = getCurrentSeasonalContext(sector)

  return {
    sector,
    period,
    kpi,
    margin,
    seasonal: {
      monthly,
      current_context: {
        current_label: ctx.currentLabel,
        current_demand: DEMAND_LABELS_TR[ctx.currentDemand],
        current_note: ctx.currentNote,
        upcoming: ctx.upcoming.map(u => ({
          label: u.label,
          demand: DEMAND_LABELS_TR[u.demand],
          note: u.note,
        })),
      },
    },
    cohort,
    recommendations,
  }
}
