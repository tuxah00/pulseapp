import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'
import type { BusinessSettings, SectorType } from '@/types'

const log = createLogger({ route: 'api/cron/ai-benchmark-aggregate' })

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

/**
 * Sektörel Benchmark Agregatörü (Faz 5.3)
 *
 * - Sadece opt-in işletmelerden veri toplar (settings.benchmark_opt_in = true).
 * - business_id kesinlikle saklanmaz; sadece sektör + metric percentile'ları yazılır.
 * - Her sektör+metric+dönem için en az 20 işletme sample'ı olmalı (aksi halde satır yazılmaz).
 * - Son tamamlanmış çeyreği hesaplar; tekrar çalıştırılırsa unique index ile upsert.
 *
 * Schedule önerisi (Vercel Pro açılınca): haftada 1 kez, pazartesi 03:30
 *   "30 3 * * 1"
 */

type Metric = 'avg_ticket' | 'occupancy' | 'retention_rate' | 'no_show_rate' | 'new_customer_rate'

interface BusinessMetrics {
  avg_ticket: number | null
  occupancy: number | null
  retention_rate: number | null
  no_show_rate: number | null
  new_customer_rate: number | null
}

const MIN_SAMPLE_SIZE = 20
const DAYS_IN_QUARTER = 90
const ASSUMED_SLOTS_PER_STAFF_PER_DAY = 8
const ASSUMED_WORKING_DAYS_PER_QUARTER = 72 // pazartesi-cumartesi

function getLastCompletedQuarter(now: Date): { start: string; end: string } {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const currentQ = Math.floor(month / 3)
  const lastQ = currentQ - 1
  let startYear = year
  let startMonth: number
  if (lastQ < 0) {
    startYear = year - 1
    startMonth = 9 // Q4: Ekim-Aralık
  } else {
    startMonth = lastQ * 3
  }
  const start = new Date(Date.UTC(startYear, startMonth, 1))
  const end = new Date(Date.UTC(startYear, startMonth + 3, 0)) // çeyreğin son günü
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  if (sorted.length === 1) return sorted[0]
  const idx = (p / 100) * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  if (lo === hi) return sorted[lo]
  const w = idx - lo
  return sorted[lo] * (1 - w) + sorted[hi] * w
}

async function computeBusinessMetrics(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  periodStart: string,
  periodEnd: string
): Promise<BusinessMetrics> {
  const startIso = `${periodStart}T00:00:00Z`
  const endIso = `${periodEnd}T23:59:59Z`

  // Tüm sorgular paralel
  const [invoicesRes, apptsRes, staffRes, newCustRes] = await Promise.all([
    admin
      .from('invoices')
      .select('total')
      .eq('business_id', businessId)
      .eq('status', 'paid')
      .is('deleted_at', null)
      .gte('created_at', startIso)
      .lte('created_at', endIso),
    admin
      .from('appointments')
      .select('status, customer_id, appointment_date')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .gte('appointment_date', periodStart)
      .lte('appointment_date', periodEnd),
    admin
      .from('staff_members')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'active'),
    admin
      .from('customers')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('created_at', startIso)
      .lte('created_at', endIso),
  ])

  // avg_ticket: ödenmiş faturaların ortalama tutarı (TL)
  const invoiceTotals = (invoicesRes.data ?? [])
    .map((i) => Number(i.total) || 0)
    .filter((v) => v > 0)
  const avg_ticket =
    invoiceTotals.length > 0
      ? invoiceTotals.reduce((a, b) => a + b, 0) / invoiceTotals.length
      : null

  // no_show_rate + retention + occupancy input: randevular
  const apptList = apptsRes.data ?? []
  const totalAppts = apptList.length
  let noShowCount = 0
  let completedCount = 0
  const customerApptCount = new Map<string, number>()
  for (const a of apptList) {
    if (a.status === 'no_show') noShowCount++
    else if (a.status === 'completed') completedCount++
    if (a.customer_id) {
      customerApptCount.set(a.customer_id, (customerApptCount.get(a.customer_id) ?? 0) + 1)
    }
  }
  const no_show_rate = totalAppts > 0 ? (noShowCount / totalAppts) * 100 : null

  // occupancy ≈ completed / (staff × working_days × slots_per_day)
  const staffCount = staffRes.count ?? 0
  const availableSlots = staffCount * ASSUMED_WORKING_DAYS_PER_QUARTER * ASSUMED_SLOTS_PER_STAFF_PER_DAY
  const occupancy = availableSlots > 0 ? Math.min((completedCount / availableSlots) * 100, 100) : null

  // retention_rate: periyotta randevusu olan müşterilerden kaçı 2+ randevulu?
  let repeatCustomers = 0
  for (const c of customerApptCount.values()) if (c >= 2) repeatCustomers++
  const totalActiveCustomers = customerApptCount.size
  const retention_rate =
    totalActiveCustomers > 0 ? (repeatCustomers / totalActiveCustomers) * 100 : null

  // new_customer_rate: periyotta oluşturulan yeni müşteri / toplam aktif müşteri (periyot içi)
  const newCustomerCount = newCustRes.count
  const new_customer_rate =
    totalActiveCustomers > 0 && newCustomerCount !== null
      ? Math.min((newCustomerCount / totalActiveCustomers) * 100, 100)
      : null

  return { avg_ticket, occupancy, retention_rate, no_show_rate, new_customer_rate }
}

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const now = new Date()
  const { start: periodStart, end: periodEnd } = getLastCompletedQuarter(now)

  // Opt-in işletmeleri çek — SQL-side JSONB filter
  const { data: optIn, error } = await admin
    .from('businesses')
    .select('id, sector')
    .eq('is_active', true)
    .contains('settings', { benchmark_opt_in: true } satisfies Partial<BusinessSettings>)

  if (error) {
    log.error({ error: error.message }, 'fetch businesses failed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  log.info(
    { period: `${periodStart} → ${periodEnd}`, totalOptIn: (optIn ?? []).length },
    'benchmark run started'
  )

  // Sektöre göre grupla
  type OptInRow = { id: string; sector: string | null }
  const sectorGroups = new Map<SectorType, OptInRow[]>()
  for (const b of (optIn ?? []) as OptInRow[]) {
    const sector = (b.sector ?? 'other') as SectorType
    const arr = sectorGroups.get(sector) ?? []
    arr.push(b)
    sectorGroups.set(sector, arr)
  }

  let writtenRows = 0
  let skippedSectors = 0

  const metricKeys: Metric[] = [
    'avg_ticket',
    'occupancy',
    'retention_rate',
    'no_show_rate',
    'new_customer_rate',
  ]
  const computedAt = now.toISOString()

  for (const [sector, bizList] of sectorGroups) {
    if (bizList.length < MIN_SAMPLE_SIZE) {
      skippedSectors++
      log.info(
        { sector, sample_size: bizList.length, required: MIN_SAMPLE_SIZE },
        'sector skipped (below sample threshold)'
      )
      continue
    }

    // İşletme metrikleri paralel hesap
    const settled = await Promise.allSettled(
      bizList.map((biz) => computeBusinessMetrics(admin, biz.id, periodStart, periodEnd))
    )
    const allMetrics: BusinessMetrics[] = []
    for (let i = 0; i < settled.length; i++) {
      const r = settled[i]
      if (r.status === 'fulfilled') allMetrics.push(r.value)
      else
        log.error(
          { business_id: bizList[i].id, error: r.reason instanceof Error ? r.reason.message : String(r.reason) },
          'metric compute failed'
        )
    }

    // Her metric için p25/p50/p75 — sadece non-null değerlerden; tek upsert'te topla
    const rows: Array<{
      sector: SectorType
      metric: Metric
      p25: number
      p50: number
      p75: number
      sample_size: number
      period_start: string
      period_end: string
      computed_at: string
    }> = []
    for (const metric of metricKeys) {
      const values = allMetrics
        .map((m) => m[metric])
        .filter((v): v is number => v !== null && !isNaN(v))
        .sort((a, b) => a - b)

      if (values.length < MIN_SAMPLE_SIZE) {
        log.info(
          { sector, metric, sample_size: values.length },
          'metric skipped (insufficient non-null samples)'
        )
        continue
      }

      rows.push({
        sector,
        metric,
        p25: Number(percentile(values, 25).toFixed(2)),
        p50: Number(percentile(values, 50).toFixed(2)),
        p75: Number(percentile(values, 75).toFixed(2)),
        sample_size: values.length,
        period_start: periodStart,
        period_end: periodEnd,
        computed_at: computedAt,
      })
    }

    if (rows.length === 0) continue

    const { error: upsertErr } = await admin
      .from('sector_benchmarks_aggregate')
      .upsert(rows, { onConflict: 'sector,metric,period_start,period_end' })

    if (upsertErr) {
      log.error({ sector, rowCount: rows.length, error: upsertErr.message }, 'upsert failed')
    } else {
      writtenRows += rows.length
    }
  }

  log.info(
    {
      period: `${periodStart} → ${periodEnd}`,
      sectors_processed: sectorGroups.size,
      sectors_skipped: skippedSectors,
      rows_written: writtenRows,
    },
    'benchmark run finished'
  )

  return NextResponse.json({
    ok: true,
    period: { start: periodStart, end: periodEnd },
    opt_in_count: (optIn ?? []).length,
    sectors_processed: sectorGroups.size,
    sectors_skipped: skippedSectors,
    rows_written: writtenRows,
  })
}
