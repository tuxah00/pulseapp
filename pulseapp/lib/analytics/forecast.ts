import type { SectorType } from '@/types'
import type { createAdminClient } from '@/lib/supabase/admin'
import { SECTOR_STRATEGY } from '@/lib/ai/strategic-context'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

/**
 * Hafif forecasting modülü:
 * - Girdi: son 90 günün günlük ciro + randevu verileri
 * - Yöntem: lineer regresyon (en küçük kareler) + sektörün aylık sezonsal çarpanı
 * - Çıktı: önümüzdeki 30 gün için günlük beklenen ciro, randevu, güven aralığı
 *
 * Not: Tam istatistiksel forecast değil — işletme sahibine trend hissi vermek için.
 * Gerçek değer ±güven aralığı içinde kalırsa "beklenen" sayılır.
 */

export interface ForecastPoint {
  date: string // YYYY-MM-DD
  expected_revenue: number
  expected_appointments: number
  lower_bound: number
  upper_bound: number
  demand_label: 'low' | 'normal' | 'high' | 'peak'
}

export interface ForecastSummary {
  period: { from: string; to: string }
  daily: ForecastPoint[]
  total_expected_revenue: number
  total_expected_appointments: number
  confidence_level: number // 0-1 arası (model güveni)
  trend: 'rising' | 'falling' | 'stable'
  trend_pct: number // günlük büyüme oranı yüzde olarak
  seasonal_adjustment_applied: boolean
  notes: string[]
}

interface DailyPoint {
  day: number // 0..N-1
  dateStr: string
  revenue: number
  appointments: number
}

function linearRegression(points: { x: number; y: number }[]): { slope: number; intercept: number; r2: number } {
  if (points.length < 2) return { slope: 0, intercept: points[0]?.y ?? 0, r2: 0 }
  const n = points.length
  const sumX = points.reduce((s, p) => s + p.x, 0)
  const sumY = points.reduce((s, p) => s + p.y, 0)
  const sumXY = points.reduce((s, p) => s + p.x * p.y, 0)
  const sumXX = points.reduce((s, p) => s + p.x * p.x, 0)
  const meanY = sumY / n

  const denom = n * sumXX - sumX * sumX
  if (denom === 0) return { slope: 0, intercept: meanY, r2: 0 }

  const slope = (n * sumXY - sumX * sumY) / denom
  const intercept = (sumY - slope * sumX) / n

  // R² hesabı
  let ssRes = 0
  let ssTot = 0
  for (const p of points) {
    const predicted = slope * p.x + intercept
    ssRes += (p.y - predicted) ** 2
    ssTot += (p.y - meanY) ** 2
  }
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0

  return { slope, intercept, r2 }
}

/** Sektör sezonsal çarpanı (aylık demand → oransal multiplier) */
function seasonalMultiplier(sector: SectorType, month: number): number {
  const strategy = SECTOR_STRATEGY[sector] ?? SECTOR_STRATEGY.other
  const pattern = strategy.seasonal[month - 1]
  if (!pattern) return 1
  switch (pattern.demand) {
    case 'low':
      return 0.75
    case 'normal':
      return 1
    case 'high':
      return 1.2
    case 'peak':
      return 1.4
    default:
      return 1
  }
}

function dateAddDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + days)
  return out
}

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export interface ForecastOptions {
  horizonDays?: number // varsayılan 30
  historyDays?: number // varsayılan 90
  applySeasonal?: boolean // varsayılan true
}

export async function computeForecast(
  admin: SupabaseAdmin,
  businessId: string,
  sector: SectorType,
  opts: ForecastOptions = {},
): Promise<ForecastSummary> {
  const horizon = opts.horizonDays ?? 30
  const history = opts.historyDays ?? 90
  const applySeasonal = opts.applySeasonal !== false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const historyStart = dateAddDays(today, -history)

  // Son 90 günün faturalarından günlük ciro
  const [invRes, aptRes] = await Promise.all([
    admin
      .from('invoices')
      .select('total, paid_amount, status, created_at')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .in('status', ['paid', 'partial'])
      .gte('created_at', historyStart.toISOString()),
    admin
      .from('appointments')
      .select('id, appointment_date, status')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .gte('appointment_date', toDateStr(historyStart)),
  ])

  // Günlük aggregate
  const dailyMap = new Map<string, { revenue: number; appointments: number }>()
  for (const inv of (invRes.data ?? []) as any[]) {
    const d = new Date(inv.created_at)
    d.setHours(0, 0, 0, 0)
    const key = toDateStr(d)
    const paid = Number(inv.paid_amount ?? inv.total ?? 0)
    const cur = dailyMap.get(key) ?? { revenue: 0, appointments: 0 }
    cur.revenue += paid
    dailyMap.set(key, cur)
  }
  for (const apt of (aptRes.data ?? []) as any[]) {
    if (apt.status === 'cancelled') continue
    const key = apt.appointment_date
    const cur = dailyMap.get(key) ?? { revenue: 0, appointments: 0 }
    cur.appointments += 1
    dailyMap.set(key, cur)
  }

  // Tüm günleri 0 ile doldur (boş günler seri için önemli)
  const series: DailyPoint[] = []
  for (let i = 0; i < history; i++) {
    const d = dateAddDays(historyStart, i)
    const key = toDateStr(d)
    const v = dailyMap.get(key) ?? { revenue: 0, appointments: 0 }
    series.push({
      day: i,
      dateStr: key,
      revenue: v.revenue,
      appointments: v.appointments,
    })
  }

  // Veri çok azsa düşük güven dön
  const nonZeroDays = series.filter(s => s.revenue > 0 || s.appointments > 0).length
  if (nonZeroDays < 5) {
    return emptyForecast(today, horizon, 'Yeterli geçmiş veri yok — en az 5 aktif gün gerekli')
  }

  // Lineer regresyon (ciro + randevu)
  const revReg = linearRegression(series.map(s => ({ x: s.day, y: s.revenue })))
  const aptReg = linearRegression(series.map(s => ({ x: s.day, y: s.appointments })))

  // Rezidüel standart sapma (güven aralığı için)
  const revResiduals = series.map(s => s.revenue - (revReg.slope * s.day + revReg.intercept))
  const revStd = standardDeviation(revResiduals)

  const daily: ForecastPoint[] = []
  let totalRev = 0
  let totalApt = 0
  const notes: string[] = []

  for (let i = 0; i < horizon; i++) {
    const x = history + i
    const forecastDate = dateAddDays(today, i)
    let predRev = Math.max(0, revReg.slope * x + revReg.intercept)
    let predApt = Math.max(0, aptReg.slope * x + aptReg.intercept)

    // Sezonsal düzeltme
    if (applySeasonal) {
      const mult = seasonalMultiplier(sector, forecastDate.getMonth() + 1)
      predRev *= mult
      predApt *= mult
    }

    // Güven aralığı: ±1.96 × std (≈ %95)
    const margin = 1.96 * revStd * Math.sqrt(1 + 1 / history)

    const pattern = SECTOR_STRATEGY[sector]?.seasonal[forecastDate.getMonth()]
    daily.push({
      date: toDateStr(forecastDate),
      expected_revenue: Math.round(predRev),
      expected_appointments: Math.round(predApt),
      lower_bound: Math.max(0, Math.round(predRev - margin)),
      upper_bound: Math.round(predRev + margin),
      demand_label: pattern?.demand ?? 'normal',
    })
    totalRev += predRev
    totalApt += predApt
  }

  // Trend: günlük büyüme oranı % olarak
  const avgDailyRev = series.reduce((s, p) => s + p.revenue, 0) / Math.max(1, series.length)
  const trendPct = avgDailyRev > 0 ? (revReg.slope / avgDailyRev) * 100 : 0
  const trend: ForecastSummary['trend'] =
    Math.abs(trendPct) < 0.3 ? 'stable' : trendPct > 0 ? 'rising' : 'falling'

  if (trend === 'rising' && trendPct > 2) {
    notes.push(`Güçlü yükseliş trendi: günde ≈%${trendPct.toFixed(1)}`)
  } else if (trend === 'falling' && trendPct < -2) {
    notes.push(`Düşüş eğilimi: günde ≈%${Math.abs(trendPct).toFixed(1)} kayıp`)
  }
  if (applySeasonal) {
    const upcomingMonth = dateAddDays(today, 15).getMonth() + 1
    const upcomingMult = seasonalMultiplier(sector, upcomingMonth)
    if (upcomingMult >= 1.3) {
      notes.push('Önümüzdeki 2 hafta sektörel zirve dönemine giriyor — kapasite planı önemli')
    } else if (upcomingMult < 0.9) {
      notes.push('Önümüzdeki 2 hafta sektörel düşük dönem — kampanya fırsatı')
    }
  }

  return {
    period: {
      from: toDateStr(today),
      to: toDateStr(dateAddDays(today, horizon - 1)),
    },
    daily,
    total_expected_revenue: Math.round(totalRev),
    total_expected_appointments: Math.round(totalApt),
    confidence_level: Math.max(0, Math.min(1, revReg.r2)),
    trend,
    trend_pct: Math.round(trendPct * 10) / 10,
    seasonal_adjustment_applied: applySeasonal,
    notes,
  }
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}

function emptyForecast(today: Date, horizon: number, note: string): ForecastSummary {
  return {
    period: { from: toDateStr(today), to: toDateStr(dateAddDays(today, horizon - 1)) },
    daily: [],
    total_expected_revenue: 0,
    total_expected_appointments: 0,
    confidence_level: 0,
    trend: 'stable',
    trend_pct: 0,
    seasonal_adjustment_applied: false,
    notes: [note],
  }
}

/**
 * What-if simülasyon: Bir kampanya senaryosunun beklenen etkisi.
 * Segment büyüklüğü × kabul oranı × ortalama bilet × (1 - indirim) - maliyet
 */
export interface CampaignSimulationInput {
  segment_size: number
  discount_pct: number // 0-100
  channel: 'sms' | 'whatsapp' | 'email'
  avg_ticket: number
  base_response_rate?: number // varsayılan 0.12
}

export interface CampaignSimulationOutput {
  expected_responses: number
  expected_revenue: number
  estimated_cost: number
  expected_profit: number
  response_rate: number
  roi_pct: number
  warnings: string[]
}

export function simulateCampaign(input: CampaignSimulationInput): CampaignSimulationOutput {
  const warnings: string[] = []
  const baseRate = input.base_response_rate ?? 0.12

  // İndirim arttıkça kabul oranı artar (ama doğrusal değil)
  const discountBoost = 1 + Math.min(0.5, input.discount_pct / 100) * 0.8
  const responseRate = Math.min(0.6, baseRate * discountBoost)

  // Kanal maliyet tablosu (aylık operasyonel)
  const costPerMessage = {
    sms: 0.15,
    whatsapp: 0.05,
    email: 0.005,
  }[input.channel]

  const expectedResponses = Math.round(input.segment_size * responseRate)
  const ticketAfterDiscount = input.avg_ticket * (1 - input.discount_pct / 100)
  const expectedRevenue = expectedResponses * ticketAfterDiscount
  const estimatedCost = input.segment_size * costPerMessage
  const expectedProfit = expectedRevenue - estimatedCost
  const roi = estimatedCost > 0 ? (expectedProfit / estimatedCost) * 100 : 0

  if (input.discount_pct > 40) {
    warnings.push('40%+ indirim marjı eritir — sadık müşteriyi fiyata alıştırabilir')
  }
  if (expectedResponses < 5) {
    warnings.push('Segment çok küçük (≤5 dönüş) — kampanyanın anlamlılığı düşük')
  }
  if (input.segment_size > 1000 && input.channel === 'sms') {
    warnings.push('1000+ SMS gönderimi maliyetli — daha ucuz kanal (WhatsApp/email) değerlendir')
  }

  return {
    expected_responses: expectedResponses,
    expected_revenue: Math.round(expectedRevenue),
    estimated_cost: Math.round(estimatedCost * 100) / 100,
    expected_profit: Math.round(expectedProfit),
    response_rate: Math.round(responseRate * 1000) / 10, // yüzde
    roi_pct: Math.round(roi),
    warnings,
  }
}
