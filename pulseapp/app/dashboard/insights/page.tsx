'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  TrendingUp,
  TrendingDown,
  Scissors,
  Megaphone,
  MessageSquare,
  Activity,
  UserCircle2,
  Users,
  Clock,
  Loader2,
  AlertTriangle,
  Sparkles,
  RotateCw,
} from 'lucide-react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { formatCurrency } from '@/lib/utils'
import type { InsightBlock } from '@/lib/insights/types'
import StrategyCard from '@/components/dashboard/insights/strategy-card'
import type { InsightsSummary } from '@/lib/analytics/insights'

import InsightSection from './_components/insight-section'
import ChartPie, { type PieDatum } from './_components/chart-pie'
import ChartBar, { type BarDatum } from './_components/chart-bar'
import ChartTrend, { type TrendPoint } from './_components/chart-trend'
import PeriodSelector, { type PeriodKey } from './_components/period-selector'

/**
 * İş Zekası paneli — yeniden tasarım.
 *
 * 6 bölüm, her biri `grafik + öneri metni + aksiyon butonu` üçlüsüyle:
 *   1. Gelir Dağılımı   (pasta)
 *   2. Gider Dağılımı   (pasta)
 *   3. Hizmet Gelirleri (yatay bar)
 *   4. Kampanya & Mesaj Akışı (yan yana iki bar)
 *   5. Doluluk + No-show (period selector + line chart)
 *   6. Müşteri Mix + Waitlist (pasta + sayaç)
 *
 * Panel üstünde /api/insights/overview'dan gelen 4 kart + opsiyonel 3 öncelikli
 * öneri (StrategyCard) durur. Her InsightSection kendi loading state'ini yönetir.
 */

// ---------- Overview KPI strip ----------

interface OverviewResponse {
  range: { from: string; to: string; days: number }
  totals: { revenue: number; expense: number; net: number }
  appointments: { completed: number; upcoming: number }
  customers: { total: number; newInRange: number }
  pendingActions: number
}

function KpiCard({
  icon,
  label,
  value,
  hint,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'good' | 'warning'
}) {
  const toneClass =
    tone === 'warning'
      ? 'text-warning-600 dark:text-warning-400'
      : tone === 'good'
        ? 'text-success-600 dark:text-success-400'
        : 'text-pulse-900 dark:text-pulse-300'
  return (
    <div className="card p-4 cursor-default">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</div>
      {hint && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</div>
      )}
    </div>
  )
}

function KpiCardSkeleton() {
  return (
    <div className="card p-4 cursor-default animate-pulse">
      <div className="flex items-center gap-2 mb-2">
        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-24 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
      <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-3 w-20 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

function StrategyCardSkeleton() {
  return (
    <div className="card p-4 cursor-default animate-pulse space-y-2">
      <div className="h-3 w-16 bg-gray-100 dark:bg-gray-800 rounded-full" />
      <div className="h-4 w-3/4 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
      <div className="h-3 w-5/6 bg-gray-100 dark:bg-gray-800 rounded" />
    </div>
  )
}

// ---------- Endpoint response shapes ----------

interface RevenueResp {
  slices: { label: string; amount: number }[]
  totals: { revenue: number }
  insight: InsightBlock | null
}
interface ExpenseResp {
  slices: { category: string; amount: number }[]
  totals: { expense: number; revenue: number }
  insight: InsightBlock | null
}
interface ServicesResp {
  services: { id: string; name: string; sessionCount: number; revenue: number; avgTicket: number }[]
  totals: { revenue: number; serviceCount: number }
  insight: InsightBlock | null
}
interface CampaignsResp {
  campaigns: {
    id: string
    name: string
    recipientCount: number
    attributedAppointments: number
    attributedRevenue: number
    estimatedCost: number
    conversionRate: number
  }[]
  totals: { recipients: number; appointments: number; revenue: number; cost: number }
  insight: InsightBlock | null
}
interface FlowsResp {
  flows: {
    template_name: string
    label: string
    sentCount: number
    attributedAppointments: number
    attributedRevenue: number
    conversionRate: number
  }[]
  totals: { sent: number; appointments: number; revenue: number }
  insight: InsightBlock | null
}
interface OccupancyResp {
  period: PeriodKey
  series: { label: string; bookedMinutes: number; availableMinutes: number; rate: number }[]
  totals: { bookedMinutes: number; availableMinutes: number; avgRate: number }
  insight: InsightBlock | null
}
interface NoShowResp {
  totals: { appointments: number; noShows: number; rate: number; riskyCustomers: number }
  staffBreakdown: { staffName: string; total: number; noShows: number; rate: number }[]
  confirmationsEnabled: boolean
  insight: InsightBlock | null
}
interface CustomerMixResp {
  distribution: { new: number; regular: number; vip: number; risk: number; lost: number }
  totals: { customers: number; riskGrowthRatio: number; vipShareOfRevenue: number }
  waitlist: {
    activeEntries: number
    filledLast30Days: number
    totalWaitlistLast90Days: number
    conversionRate: number
  }
  segmentInsight: InsightBlock | null
  waitlistInsight: InsightBlock | null
}

type EndpointState<T> = {
  data: T | null
  loading: boolean
  error: string | null
}

function initialState<T>(): EndpointState<T> {
  return { data: null, loading: true, error: null }
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((json as { error?: string }).error || `${res.status}`)
  return json as T
}

// ---------- Chart data adapters ----------

function revenueToPie(data: RevenueResp | null): PieDatum[] {
  if (!data) return []
  return data.slices.map((s) => ({ key: s.label, label: s.label, value: s.amount }))
}

function expenseToPie(data: ExpenseResp | null): PieDatum[] {
  if (!data) return []
  return data.slices.map((s) => ({ key: s.category, label: s.category, value: s.amount }))
}

function servicesToBar(data: ServicesResp | null): BarDatum[] {
  if (!data) return []
  return data.services.slice(0, 8).map((s) => ({
    key: s.id,
    label: s.name,
    value: s.revenue,
    meta: `${s.sessionCount} seans · Ort. ${formatCurrency(s.avgTicket)}`,
  }))
}

function campaignsToBar(data: CampaignsResp | null): {
  bars: BarDatum[]
  positive: string[]
  negative: string[]
} {
  if (!data) return { bars: [], positive: [], negative: [] }
  const positive: string[] = []
  const negative: string[] = []
  const bars = data.campaigns.slice(0, 6).map((c) => {
    const roi = c.estimatedCost > 0 ? c.attributedRevenue / c.estimatedCost : 0
    if (c.recipientCount >= 30) {
      if (roi >= 3) positive.push(c.id)
      else if (roi < 1 && c.attributedRevenue === 0) negative.push(c.id)
    }
    return {
      key: c.id,
      label: c.name,
      value: c.attributedRevenue,
      meta: `${c.recipientCount} gönderim · ${c.attributedAppointments} randevu · ROI ${roi.toFixed(1)}×`,
    }
  })
  return { bars, positive, negative }
}

function flowsToBar(data: FlowsResp | null): BarDatum[] {
  if (!data) return []
  return data.flows.slice(0, 6).map((f) => ({
    key: f.template_name,
    label: f.label,
    value: f.attributedRevenue,
    meta: `${f.sentCount} gönderim · ${f.attributedAppointments} randevu · %${(f.conversionRate * 100).toFixed(1)} dönüşüm`,
  }))
}

function occupancyToTrend(data: OccupancyResp | null): TrendPoint[] {
  if (!data) return []
  return data.series.map((s) => ({
    label: s.label,
    value: Math.round(s.rate * 100),
  }))
}

function segmentToPie(data: CustomerMixResp | null): PieDatum[] {
  if (!data) return []
  const d = data.distribution
  return [
    { key: 'vip', label: 'VIP', value: d.vip },
    { key: 'regular', label: 'Düzenli', value: d.regular },
    { key: 'new', label: 'Yeni', value: d.new },
    { key: 'risk', label: 'Risk', value: d.risk },
    { key: 'lost', label: 'Kayıp', value: d.lost },
  ].filter((s) => s.value > 0)
}

// ---------- Page ----------

export default function InsightsPage() {
  const { permissions } = useBusinessContext()
  requirePermission(permissions, 'insights')

  const [overview, setOverview] = useState<EndpointState<OverviewResponse>>(initialState())
  const [summary, setSummary] = useState<EndpointState<InsightsSummary>>(initialState())
  const [revenue, setRevenue] = useState<EndpointState<RevenueResp>>(initialState())
  const [expense, setExpense] = useState<EndpointState<ExpenseResp>>(initialState())
  const [services, setServices] = useState<EndpointState<ServicesResp>>(initialState())
  const [campaigns, setCampaigns] = useState<EndpointState<CampaignsResp>>(initialState())
  const [flows, setFlows] = useState<EndpointState<FlowsResp>>(initialState())
  const [occupancy, setOccupancy] = useState<EndpointState<OccupancyResp>>(initialState())
  const [noShow, setNoShow] = useState<EndpointState<NoShowResp>>(initialState())
  const [customerMix, setCustomerMix] = useState<EndpointState<CustomerMixResp>>(initialState())

  const [period, setPeriod] = useState<PeriodKey>('weekly')
  const [refreshKey, setRefreshKey] = useState(0)

  // Tek bir endpoint'i yeniden çekmek için kullanılabilir loader (retry için)
  const loadEndpoint = useCallback(
    function load<T>(
      url: string,
      setter: React.Dispatch<React.SetStateAction<EndpointState<T>>>,
    ) {
      setter({ data: null, loading: true, error: null })
      return fetchJson<T>(url)
        .then((data) => {
          setter({ data, loading: false, error: null })
        })
        .catch((err: unknown) => {
          setter({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Hata',
          })
        })
    },
    [],
  )

  // İlk yükleme + manuel yenileme — sayfa açılırken / refreshKey değişince paralel fetch
  useEffect(() => {
    let cancelled = false

    function loadCancellable<T>(
      url: string,
      setter: React.Dispatch<React.SetStateAction<EndpointState<T>>>,
    ) {
      setter({ data: null, loading: true, error: null })
      fetchJson<T>(url)
        .then((data) => {
          if (cancelled) return
          setter({ data, loading: false, error: null })
        })
        .catch((err: unknown) => {
          if (cancelled) return
          setter({
            data: null,
            loading: false,
            error: err instanceof Error ? err.message : 'Hata',
          })
        })
    }

    loadCancellable<OverviewResponse>('/api/insights/overview?days=30', setOverview)
    loadCancellable<InsightsSummary>('/api/insights/summary', setSummary)
    loadCancellable<RevenueResp>('/api/insights/revenue-breakdown?days=30', setRevenue)
    loadCancellable<ExpenseResp>('/api/insights/expense-breakdown?days=30', setExpense)
    loadCancellable<ServicesResp>('/api/insights/services?days=30', setServices)
    loadCancellable<CampaignsResp>('/api/insights/campaigns-roi?days=30', setCampaigns)
    loadCancellable<FlowsResp>('/api/insights/message-flows-roi?days=30', setFlows)
    loadCancellable<NoShowResp>('/api/insights/no-show?days=30', setNoShow)
    loadCancellable<CustomerMixResp>('/api/insights/customer-mix?days=30', setCustomerMix)

    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const isRefreshing =
    overview.loading ||
    summary.loading ||
    revenue.loading ||
    expense.loading ||
    services.loading ||
    campaigns.loading ||
    flows.loading ||
    noShow.loading ||
    customerMix.loading

  // Period değiştikçe yalnızca doluluk endpoint'i yenilenir
  useEffect(() => {
    let cancelled = false
    setOccupancy({ data: null, loading: true, error: null })
    fetchJson<OccupancyResp>(`/api/insights/occupancy-periodic?days=30&period=${period}`)
      .then((data) => {
        if (cancelled) return
        setOccupancy({ data, loading: false, error: null })
      })
      .catch((err: unknown) => {
        if (cancelled) return
        setOccupancy({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : 'Hata',
        })
      })
    return () => {
      cancelled = true
    }
  }, [period])

  const topRecs = useMemo(
    () => (summary.data?.recommendations ?? []).slice(0, 3),
    [summary.data],
  )

  // ---------- Chart data memos ----------

  const revenuePie = useMemo(() => revenueToPie(revenue.data), [revenue.data])
  const expensePie = useMemo(() => expenseToPie(expense.data), [expense.data])
  const servicesBar = useMemo(() => servicesToBar(services.data), [services.data])
  const campaignsData = useMemo(() => campaignsToBar(campaigns.data), [campaigns.data])
  const flowsBar = useMemo(() => flowsToBar(flows.data), [flows.data])
  const occupancyTrend = useMemo(() => occupancyToTrend(occupancy.data), [occupancy.data])
  const segmentPie = useMemo(() => segmentToPie(customerMix.data), [customerMix.data])

  // En büyük gelir dilimini konsantrasyon uyarısı için vurgula
  const revenueHighlightKey = useMemo(() => {
    if (!revenue.data || revenue.data.totals.revenue <= 0) return undefined
    const top = [...revenue.data.slices].sort((a, b) => b.amount - a.amount)[0]
    if (!top) return undefined
    const share = top.amount / revenue.data.totals.revenue
    return share >= 0.5 ? top.label : undefined
  }, [revenue.data])

  const expenseHighlightKey = useMemo(() => {
    if (!expense.data || expense.data.totals.expense <= 0) return undefined
    const top = [...expense.data.slices].sort((a, b) => b.amount - a.amount)[0]
    if (!top) return undefined
    const share = top.amount / expense.data.totals.expense
    return share >= 0.4 ? top.category : undefined
  }, [expense.data])

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-pulse-900 dark:text-pulse-300" />
            İş Zekası
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            İşletmenin nabzı, fırsatlar ve önerilen aksiyonlar · Son 30 gün
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          disabled={isRefreshing}
          className="btn-secondary text-sm gap-1.5 disabled:opacity-60"
          title="Tüm bölümleri yeniden yükle"
        >
          <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Yenileniyor…' : 'Yenile'}
        </button>
      </div>

      {/* Overview KPI strip */}
      {overview.loading ? (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
          <KpiCardSkeleton />
        </section>
      ) : overview.error ? (
        <div className="card p-4 border-danger-200 dark:border-danger-800 flex items-start gap-3 cursor-default">
          <AlertTriangle className="w-5 h-5 text-danger-500 shrink-0 mt-0.5" />
          <div className="flex-1 text-sm text-danger-700 dark:text-danger-300">
            <div className="font-medium">Özet yüklenemedi</div>
            <div className="text-xs text-danger-600/80 dark:text-danger-400/80 mt-0.5">{overview.error}</div>
          </div>
          <button
            type="button"
            onClick={() => loadEndpoint<OverviewResponse>('/api/insights/overview?days=30', setOverview)}
            className="text-xs px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-danger-200 dark:border-danger-800 text-danger-700 dark:text-danger-300 hover:bg-danger-50 dark:hover:bg-danger-900/20 transition-colors flex items-center gap-1.5 shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            Tekrar Dene
          </button>
        </div>
      ) : overview.data ? (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Gelir (son 30 gün)"
            value={formatCurrency(overview.data.totals.revenue)}
            hint={`${overview.data.appointments.completed} tamamlanan randevu`}
            tone="good"
          />
          <KpiCard
            icon={<TrendingDown className="w-4 h-4" />}
            label="Gider (son 30 gün)"
            value={formatCurrency(overview.data.totals.expense)}
            hint={
              overview.data.totals.net >= 0
                ? `Net ${formatCurrency(overview.data.totals.net)}`
                : `Zarar ${formatCurrency(Math.abs(overview.data.totals.net))}`
            }
            tone={overview.data.totals.net >= 0 ? 'default' : 'warning'}
          />
          <KpiCard
            icon={<UserCircle2 className="w-4 h-4" />}
            label="Müşteri"
            value={overview.data.customers.total.toLocaleString('tr-TR')}
            hint={`${overview.data.customers.newInRange} yeni · ${overview.data.appointments.upcoming} yaklaşan`}
          />
          <KpiCard
            icon={<Sparkles className="w-4 h-4" />}
            label="Bekleyen Aksiyon"
            value={overview.data.pendingActions.toLocaleString('tr-TR')}
            hint="Asistan kuyruğunda onay bekleyen öneri"
            tone={overview.data.pendingActions > 0 ? 'warning' : 'default'}
          />
        </section>
      ) : null}

      {/* Öncelikli Öneriler — eski summary'den gelen 3 strateji kartı */}
      {(summary.loading || topRecs.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Öncelikli Öneriler
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary.loading ? (
              <>
                <StrategyCardSkeleton />
                <StrategyCardSkeleton />
                <StrategyCardSkeleton />
              </>
            ) : (
              topRecs.map((rec) => <StrategyCard key={rec.id} rec={rec} compact />)
            )}
          </div>
        </section>
      )}

      {/* 1 — Gelir Dağılımı */}
      <InsightSection
        title="Gelir Dağılımı"
        description="Hizmet, ürün, paket ve manuel gelir kırılımı"
        icon={<TrendingUp className="w-4 h-4" />}
        meta={
          revenue.data ? (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              Toplam: {formatCurrency(revenue.data.totals.revenue)}
            </span>
          ) : null
        }
        loading={revenue.loading}
        error={revenue.error}
        onRetry={() => loadEndpoint<RevenueResp>('/api/insights/revenue-breakdown?days=30', setRevenue)}
        chart={
          <ChartPie
            data={revenuePie}
            currency
            highlightKey={revenueHighlightKey}
          />
        }
        insight={revenue.data?.insight ?? null}
      />

      {/* 2 — Gider Dağılımı */}
      <InsightSection
        title="Gider Dağılımı"
        description="Kategori bazında giderler"
        icon={<TrendingDown className="w-4 h-4" />}
        meta={
          expense.data ? (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              Toplam: {formatCurrency(expense.data.totals.expense)}
            </span>
          ) : null
        }
        loading={expense.loading}
        error={expense.error}
        onRetry={() => loadEndpoint<ExpenseResp>('/api/insights/expense-breakdown?days=30', setExpense)}
        chart={
          <ChartPie
            data={expensePie}
            currency
            highlightKey={expenseHighlightKey}
          />
        }
        insight={expense.data?.insight ?? null}
      />

      {/* 3 — Hizmet Gelirleri */}
      <InsightSection
        title="Hizmet Gelirleri"
        description="En çok gelir getiren hizmetler ve ortalama bilet"
        icon={<Scissors className="w-4 h-4" />}
        meta={
          <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Scissors className="w-3.5 h-3.5" />
            {services.data?.totals.serviceCount ?? 0} hizmet
          </span>
        }
        loading={services.loading}
        error={services.error}
        onRetry={() => loadEndpoint<ServicesResp>('/api/insights/services?days=30', setServices)}
        chart={<ChartBar data={servicesBar} currency />}
        insight={services.data?.insight ?? null}
      />

      {/* 4 — Kampanya & Mesaj Akışı Etkinliği */}
      <section className="card cursor-default overflow-hidden">
        <header className="flex items-start gap-3 px-5 pt-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-50 dark:bg-pulse-950/40 text-pulse-900 dark:text-pulse-300 shrink-0 mt-0.5">
            <Megaphone className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Kampanya & Mesaj Akışı Etkinliği
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Her kampanyanın ve otomatik mesaj akışının attribute edilen cirosu
            </p>
          </div>
        </header>

        <div className="px-5 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                Kampanyalar
              </span>
              {campaigns.data && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                  {campaigns.data.totals.appointments} randevu ·{' '}
                  {formatCurrency(campaigns.data.totals.revenue)}
                </span>
              )}
            </div>
            {campaigns.loading ? (
              <div className="h-48 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800 animate-pulse flex items-center justify-center">
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Veri hazırlanıyor…
                </span>
              </div>
            ) : campaigns.error ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
                <AlertTriangle className="w-5 h-5 text-danger-500 dark:text-danger-400" />
                <p className="text-xs text-gray-500 dark:text-gray-400">{campaigns.error}</p>
                <button
                  type="button"
                  onClick={() => loadEndpoint<CampaignsResp>('/api/insights/campaigns-roi?days=30', setCampaigns)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-pulse-300 dark:hover:border-pulse-700 hover:text-pulse-900 dark:hover:text-pulse-300 transition-colors flex items-center gap-1.5 text-gray-600 dark:text-gray-400"
                >
                  <RotateCw className="w-3 h-3" />
                  Tekrar Dene
                </button>
              </div>
            ) : (
              <ChartBar
                data={campaignsData.bars}
                currency
                highlightKeys={campaignsData.positive}
                limit={6}
              />
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300 flex items-center gap-1">
                <MessageSquare className="w-3.5 h-3.5" />
                Mesaj akışları
              </span>
              {flows.data && (
                <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
                  {flows.data.totals.sent} gönderim ·{' '}
                  {formatCurrency(flows.data.totals.revenue)}
                </span>
              )}
            </div>
            {flows.loading ? (
              <div className="h-48 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800 animate-pulse flex items-center justify-center">
                <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Veri hazırlanıyor…
                </span>
              </div>
            ) : flows.error ? (
              <div className="h-48 flex flex-col items-center justify-center gap-2 text-center">
                <AlertTriangle className="w-5 h-5 text-danger-500 dark:text-danger-400" />
                <p className="text-xs text-gray-500 dark:text-gray-400">{flows.error}</p>
                <button
                  type="button"
                  onClick={() => loadEndpoint<FlowsResp>('/api/insights/message-flows-roi?days=30', setFlows)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-pulse-300 dark:hover:border-pulse-700 hover:text-pulse-900 dark:hover:text-pulse-300 transition-colors flex items-center gap-1.5 text-gray-600 dark:text-gray-400"
                >
                  <RotateCw className="w-3 h-3" />
                  Tekrar Dene
                </button>
              </div>
            ) : (
              <ChartBar data={flowsBar} currency limit={6} />
            )}
          </div>
        </div>

        <div className="px-5 pb-5 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <InsightSideBlock insight={campaigns.data?.insight ?? null} loading={campaigns.loading} />
          <InsightSideBlock insight={flows.data?.insight ?? null} loading={flows.loading} />
        </div>
      </section>

      {/* 5 — Doluluk + No-show */}
      <InsightSection
        title="Doluluk & No-show"
        description="Zaman bazlı doluluk ve gelmeyen müşteri oranı"
        icon={<Activity className="w-4 h-4" />}
        onRetry={() => loadEndpoint<OccupancyResp>(`/api/insights/occupancy-periodic?days=30&period=${period}`, setOccupancy)}
        headerExtra={
          <PeriodSelector
            value={period}
            onChange={setPeriod}
            trailing={
              noShow.data ? (
                <span
                  className={`text-[11px] tabular-nums px-2 py-0.5 rounded-full ${
                    noShow.data.totals.rate > 0.1
                      ? 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300'
                      : 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                  }`}
                >
                  No-show %{(noShow.data.totals.rate * 100).toFixed(1)}
                </span>
              ) : null
            }
          />
        }
        loading={occupancy.loading}
        error={occupancy.error}
        chart={
          <div className="space-y-2">
            <ChartTrend
              data={occupancyTrend}
              unit="%"
              seriesName="Doluluk"
              benchmark={60}
              benchmarkLabel="Hedef %60"
            />
            {occupancy.data && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums flex items-center gap-3 flex-wrap">
                <span className="flex items-center gap-1">
                  <Activity className="w-3.5 h-3.5" />
                  Ortalama: %{(occupancy.data.totals.avgRate * 100).toFixed(1)}
                </span>
                {noShow.data && (
                  <>
                    <span>·</span>
                    <span>{noShow.data.totals.appointments} tamamlanan/no-show</span>
                    <span>·</span>
                    <span>{noShow.data.totals.riskyCustomers} riskli müşteri</span>
                  </>
                )}
              </div>
            )}
          </div>
        }
        insight={occupancy.data?.insight ?? null}
      />

      {/* Yan blok: no-show metni ayrı panel olarak */}
      {!noShow.loading && noShow.data?.insight && (
        <InsightSection
          title="No-show Detayı"
          description="Personel kırılımı ve riskli müşteri sayısı"
          icon={<AlertTriangle className="w-4 h-4" />}
          onRetry={() => loadEndpoint<NoShowResp>('/api/insights/no-show?days=30', setNoShow)}
          chart={
            <div className="space-y-2">
              {noShow.data.staffBreakdown.length > 0 ? (
                <div className="space-y-1.5">
                  {noShow.data.staffBreakdown.slice(0, 5).map((s) => (
                    <div
                      key={s.staffName}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="text-gray-700 dark:text-gray-300">
                        {s.staffName}
                      </span>
                      <span className="flex items-center gap-2">
                        <div className="relative w-24 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className={`absolute inset-y-0 left-0 ${
                              s.rate > 0.15
                                ? 'bg-danger-500'
                                : s.rate > 0.08
                                  ? 'bg-warning-500'
                                  : 'bg-success-500'
                            }`}
                            style={{ width: `${Math.min(100, s.rate * 100 * 3)}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-gray-600 dark:text-gray-400 min-w-[48px] text-right">
                          %{(s.rate * 100).toFixed(1)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-500 dark:text-gray-400 py-6 text-center">
                  Personel bazlı kırılım için yeterli randevu yok.
                </div>
              )}
              <div className="flex gap-2 pt-2 text-[11px]">
                <span
                  className={`px-2 py-0.5 rounded-full ${
                    noShow.data.confirmationsEnabled
                      ? 'bg-success-100 text-success-700 dark:bg-success-900/30 dark:text-success-300'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                  }`}
                >
                  Onay SMS: {noShow.data.confirmationsEnabled ? 'Açık' : 'Kapalı'}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300">
                  {noShow.data.totals.riskyCustomers} riskli müşteri
                </span>
              </div>
            </div>
          }
          insight={noShow.data.insight}
        />
      )}

      {/* 6 — Müşteri Mix + Waitlist */}
      <InsightSection
        title="Müşteri Mix"
        description="Yeni / Düzenli / VIP / Risk / Kayıp segmentlerinin dağılımı"
        icon={<Users className="w-4 h-4" />}
        meta={
          customerMix.data ? (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 tabular-nums">
              {customerMix.data.totals.customers} müşteri · VIP payı %
              {(customerMix.data.totals.vipShareOfRevenue * 100).toFixed(0)}
            </span>
          ) : null
        }
        loading={customerMix.loading}
        error={customerMix.error}
        onRetry={() => loadEndpoint<CustomerMixResp>('/api/insights/customer-mix?days=30', setCustomerMix)}
        chart={<ChartPie data={segmentPie} highlightKey={customerMix.data && customerMix.data.totals.riskGrowthRatio > 1.15 ? 'risk' : undefined} />}
        insight={customerMix.data?.segmentInsight ?? null}
      />

      {!customerMix.loading && customerMix.data?.waitlistInsight && (
        <InsightSection
          title="Bekleme Listesi"
          description="Son 90 günde waitlist aktivitesi"
          icon={<Clock className="w-4 h-4" />}
          chart={
            <div className="grid grid-cols-3 gap-3">
              <WaitlistStat
                label="Aktif"
                value={customerMix.data.waitlist.activeEntries}
                hint="Şu an beklemede"
              />
              <WaitlistStat
                label="Son 30 günde dolduruldu"
                value={customerMix.data.waitlist.filledLast30Days}
                hint="Waitlist'ten randevuya"
                tone="good"
              />
              <WaitlistStat
                label="Dönüşüm"
                value={`${(customerMix.data.waitlist.conversionRate * 100).toFixed(1)}%`}
                hint="90 günlük ortalama"
              />
            </div>
          }
          insight={customerMix.data.waitlistInsight}
        />
      )}
    </div>
  )
}

/**
 * 4. bölümde (kampanya + mesaj akışı) iki grafik yan yana olduğu için
 * sağ kolondaki öneri metni InsightSection yerine bu küçük kart olarak gösterilir.
 * Aksiyon butonları burada yok — kampanya/mesaj akışı için "Uygula" akışı
 * ayrı bir epik; önce metrik güveni oluşsun.
 */
function InsightSideBlock({
  insight,
  loading,
}: {
  insight: InsightBlock | null
  loading?: boolean
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3 animate-pulse space-y-2">
        <div className="h-3 w-2/3 bg-gray-200 dark:bg-gray-700 rounded" />
        <div className="h-3 w-full bg-gray-100 dark:bg-gray-800 rounded" />
        <div className="h-3 w-5/6 bg-gray-100 dark:bg-gray-800 rounded" />
      </div>
    )
  }
  if (!insight) {
    return (
      <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-3 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
        <Sparkles className="w-3.5 h-3.5 opacity-60" />
        <span>Yeterli veri olunca burada öneri görünecek.</span>
      </div>
    )
  }
  return (
    <div className="rounded-xl border border-pulse-100 dark:border-pulse-900/60 bg-pulse-50/60 dark:bg-pulse-950/40 p-3">
      <div className="text-xs font-semibold text-gray-900 dark:text-gray-100 mb-1">
        {insight.title}
      </div>
      <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
        {insight.message}
      </p>
    </div>
  )
}

function WaitlistStat({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: string | number
  hint?: string
  tone?: 'default' | 'good'
}) {
  const toneClass =
    tone === 'good'
      ? 'text-success-600 dark:text-success-400'
      : 'text-pulse-900 dark:text-pulse-300'
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-3">
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{label}</div>
      <div className={`text-xl font-semibold tabular-nums ${toneClass}`}>
        {typeof value === 'number' ? value.toLocaleString('tr-TR') : value}
      </div>
      {hint && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{hint}</div>
      )}
    </div>
  )
}
