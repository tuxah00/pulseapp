import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'
import type { SectorType } from '@/types'

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

  // avg_ticket: ödenmiş faturaların ortalama tutarı (TL)
  const { data: invoices } = await admin
    .from('invoices')
    .select('total')
    .eq('business_id', businessId)
    .eq('status', 'paid')
    .is('deleted_at', null)
    .gte('created_at', startIso)
    .lte('created_at', endIso)

  const invoiceTotals = (invoices ?? [])
    .map((i) => Number(i.total) || 0)
    .filter((v) => v > 0)
  const avg_ticket =
    invoiceTotals.length > 0
      ? invoiceTotals.reduce((a, b) => a + b, 0) / invoiceTotals.length
      : null

  // no_show_rate + occupancy input: randevular
  const { data: appts } = await admin
    .from('appointments')
    .select('status, customer_id, appointment_date')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .gte('appointment_date', periodStart)
    .lte('appointment_date', periodEnd)

  const apptList = appts ?? []
  const totalAppts = apptList.length
  const noShowCount = apptList.filter((a) => a.status === 'no_show').length
  const completedCount = apptList.filter((a) => a.status === 'completed').length
  const no_show_rate = totalAppts > 0 ? (noShowCount / totalAppts) * 100 : null

  // occupancy ≈ completed / (staff × working_days × slots_per_day)
  const { data: staff } = await admin
    .from('staff_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('status', 'active')

  const staffCount = (staff ?? []).length
  const availableSlots = staffCount * ASSUMED_WORKING_DAYS_PER_QUARTER * ASSUMED_SLOTS_PER_STAFF_PER_DAY
  const occupancy = availableSlots > 0 ? Math.min((completedCount / availableSlots) * 100, 100) : null

  // retention_rate: periyotta randevusu olan müşterilerden kaçı 2+ randevulu?
  const customerApptCount = new Map<string, number>()
  for (const a of apptList) {
    if (!a.customer_id) continue
    customerApptCount.set(a.customer_id, (customerApptCount.get(a.customer_id) ?? 0) + 1)
  }
  const totalActiveCustomers = customerApptCount.size
  const repeatCustomers = Array.from(customerApptCount.values()).filter((c) => c >= 2).length
  const retention_rate =
    totalActiveCustomers > 0 ? (repeatCustomers / totalActiveCustomers) * 100 : null

  // new_customer_rate: periyotta oluşturulan yeni müşteri / toplam aktif müşteri (periyot içi)
  const { count: newCustomerCount } = await admin
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('created_at', startIso)
    .lte('created_at', endIso)

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

  // Opt-in işletmeleri çek — settings.benchmark_opt_in = true
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id, sector, settings')
    .eq('is_active', true)

  if (error) {
    log.error({ error: error.message }, 'fetch businesses failed')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const optIn = (businesses ?? []).filter(
    (b) => b.settings && typeof b.settings === 'object' && (b.settings as any).benchmark_opt_in === true
  )

  log.info(
    { period: `${periodStart} → ${periodEnd}`, totalOptIn: optIn.length },
    'benchmark run started'
  )

  // Sektöre göre grupla
  const sectorGroups = new Map<SectorType, typeof optIn>()
  for (const b of optIn) {
    const sector = b.sector as SectorType
    const arr = sectorGroups.get(sector) ?? []
    arr.push(b)
    sectorGroups.set(sector, arr)
  }

  let writtenRows = 0
  let skippedSectors = 0

  for (const [sector, bizList] of sectorGroups) {
    if (bizList.length < MIN_SAMPLE_SIZE) {
      skippedSectors++
      log.info(
        { sector, sample_size: bizList.length, required: MIN_SAMPLE_SIZE },
        'sector skipped (below sample threshold)'
      )
      continue
    }

    // Her işletme için metrikler
    const allMetrics: BusinessMetrics[] = []
    for (const biz of bizList) {
      try {
        const m = await computeBusinessMetrics(admin, biz.id, periodStart, periodEnd)
        allMetrics.push(m)
      } catch (err) {
        log.error(
          { business_id: biz.id, error: err instanceof Error ? err.message : String(err) },
          'metric compute failed'
        )
      }
    }

    // Her metric için p25/p50/p75 — sadece non-null değerlerden
    const metricKeys: Metric[] = [
      'avg_ticket',
      'occupancy',
      'retention_rate',
      'no_show_rate',
      'new_customer_rate',
    ]

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

      const p25 = Number(percentile(values, 25).toFixed(2))
      const p50 = Number(percentile(values, 50).toFixed(2))
      const p75 = Number(percentile(values, 75).toFixed(2))

      const { error: upsertErr } = await admin
        .from('sector_benchmarks_aggregate')
        .upsert(
          {
            sector,
            metric,
            p25,
            p50,
            p75,
            sample_size: values.length,
            period_start: periodStart,
            period_end: periodEnd,
            computed_at: now.toISOString(),
          },
          { onConflict: 'sector,metric,period_start,period_end' }
        )

      if (upsertErr) {
        log.error(
          { sector, metric, error: upsertErr.message },
          'upsert failed'
        )
      } else {
        writtenRows++
      }
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
    opt_in_count: optIn.length,
    sectors_processed: sectorGroups.size,
    sectors_skipped: skippedSectors,
    rows_written: writtenRows,
  })
}
