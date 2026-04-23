// ================================================
// lib/segments/compute.ts
// Müşteri segment hesaplama — runtime utility
// ================================================
// Mevcut veritabanında customers.segment alanı doldurulurken kullanılan
// kurallar burada merkezileştirilir. API endpoint'leri (özellikle
// /api/insights/customer-mix) bu helper'ı çağırarak anlık dağılım üretir.
//
// NOT: Günlük batch recompute (cron) Vercel Pro aboneliği açılana kadar
// ertelenmiştir. Şimdilik her isteğin runtime'ında hesaplanır.

import type { CustomerSegment } from '@/types'
import type { SegmentDistribution } from '@/lib/insights/templates'

export interface SegmentInputCustomer {
  id: string
  created_at: string
  last_visit_at: string | null
  total_visits: number
  total_revenue: number
  no_show_score: number | null
}

export interface SegmentComputeOptions {
  /** Referans tarih (test/backfill için override edilebilir). Default: şimdi. */
  now?: Date
  /**
   * İşletme medyan geliri. Bilinmiyorsa tek geçiş için
   * `computeRevenueMedian()` ile hesaplanabilir. 0 veya undefined ise
   * VIP eşiği yalnızca ziyaret sayısına bakar.
   */
  businessMedianRevenue?: number
}

const DAY = 24 * 60 * 60 * 1000

/**
 * Tek müşteri için segment belirler.
 *
 * Öncelik sırası (en üst kazanır):
 *  1. lost   — son ziyaret > 180 gün
 *  2. risk   — son ziyaret 60–120 gün VEYA no_show_score > 40
 *  3. vip    — toplam gelir ≥ medyan×3 VEYA 10+ ziyaret
 *  4. regular— 3+ ziyaret son 6 ay
 *  5. new    — kayıt < 30 gün & ziyaret ≤ 2
 *  6. fallback→ new (yeni ama 2+ ziyaretli) veya regular
 */
export function computeCustomerSegment(
  customer: SegmentInputCustomer,
  options: SegmentComputeOptions = {}
): CustomerSegment {
  const now = options.now ?? new Date()
  const medianRevenue = options.businessMedianRevenue ?? 0

  const createdAt = new Date(customer.created_at)
  const lastVisitAt = customer.last_visit_at
    ? new Date(customer.last_visit_at)
    : null
  const daysSinceLastVisit = lastVisitAt
    ? (now.getTime() - lastVisitAt.getTime()) / DAY
    : null
  const daysSinceCreated = (now.getTime() - createdAt.getTime()) / DAY

  // 1) LOST — son ziyaret 180 günü aştıysa
  if (daysSinceLastVisit != null && daysSinceLastVisit > 180) {
    return 'lost'
  }

  // 2) RISK
  if (
    (daysSinceLastVisit != null &&
      daysSinceLastVisit >= 60 &&
      daysSinceLastVisit <= 120) ||
    (customer.no_show_score ?? 0) > 40
  ) {
    return 'risk'
  }

  // 3) VIP
  if (
    customer.total_visits >= 10 ||
    (medianRevenue > 0 && customer.total_revenue >= medianRevenue * 3)
  ) {
    return 'vip'
  }

  // 4) REGULAR — son 6 ayda ≥3 ziyaret
  if (
    customer.total_visits >= 3 &&
    daysSinceLastVisit != null &&
    daysSinceLastVisit <= 180
  ) {
    return 'regular'
  }

  // 5) NEW
  if (daysSinceCreated < 30 && customer.total_visits <= 2) {
    return 'new'
  }

  // 6) Fallback — kayıt eski, düşük ziyaret: "new" olarak işaretlenir
  // (kaybedilmemiş, regular eşiğine ulaşmamış). Bu durum genelde ziyaret
  // girişi unutulan müşterilerdir; panel uyarı üretecektir.
  return 'new'
}

/**
 * Bir dizi müşteri için segment dağılımını verir.
 * Medyan hesabı tek geçişte yapılır, sonra segment kararı.
 */
export function computeSegmentDistribution(
  customers: SegmentInputCustomer[],
  options: Omit<SegmentComputeOptions, 'businessMedianRevenue'> = {}
): {
  distribution: SegmentDistribution
  total: number
  medianRevenue: number
} {
  const medianRevenue = computeRevenueMedian(customers)
  const distribution: SegmentDistribution = {
    new: 0,
    regular: 0,
    vip: 0,
    risk: 0,
    lost: 0,
  }
  for (const c of customers) {
    const seg = computeCustomerSegment(c, {
      ...options,
      businessMedianRevenue: medianRevenue,
    })
    distribution[seg] += 1
  }
  return {
    distribution,
    total: customers.length,
    medianRevenue,
  }
}

/**
 * VIP segmentinin ciroya katkısını hesaplar (0-1 arası).
 * Template motoru `vipShareOfRevenue` alanı için kullanır.
 */
export function computeVipShareOfRevenue(
  customers: SegmentInputCustomer[],
  options: Omit<SegmentComputeOptions, 'businessMedianRevenue'> = {}
): number {
  const medianRevenue = computeRevenueMedian(customers)
  let vipRevenue = 0
  let totalRevenue = 0
  for (const c of customers) {
    totalRevenue += c.total_revenue
    const seg = computeCustomerSegment(c, {
      ...options,
      businessMedianRevenue: medianRevenue,
    })
    if (seg === 'vip') vipRevenue += c.total_revenue
  }
  return totalRevenue > 0 ? vipRevenue / totalRevenue : 0
}

/**
 * Risk segmentinin 30 günlük büyüme oranını tahmin eder (1.0 = değişim yok).
 * Yaklaşım: şu an risk olanlardan, son 30 gün içinde risk eşiğine yeni
 * girmiş olanların payı çıkarılır; eski sayıya bölünür.
 *
 * NOT: Tam tarihsel snapshot yok. Yeni girenleri, last_visit_at'i 60–90
 * gün aralığında olanlar olarak yaklaşıklar.
 */
export function computeRiskGrowthRatio(
  customers: SegmentInputCustomer[],
  options: SegmentComputeOptions = {}
): number {
  const now = options.now ?? new Date()
  const medianRevenue = options.businessMedianRevenue ?? computeRevenueMedian(customers)

  let currentRisk = 0
  let justEnteredRisk = 0
  for (const c of customers) {
    const seg = computeCustomerSegment(c, {
      now,
      businessMedianRevenue: medianRevenue,
    })
    if (seg !== 'risk') continue
    currentRisk += 1
    if (!c.last_visit_at) continue
    const days =
      (now.getTime() - new Date(c.last_visit_at).getTime()) / DAY
    if (days >= 60 && days <= 90) justEnteredRisk += 1
  }

  const previousRisk = currentRisk - justEnteredRisk
  if (previousRisk <= 0) {
    return currentRisk > 0 ? 2 : 1 // sıfırdan büyümeyi kabaca 2× göster
  }
  return currentRisk / previousRisk
}

/**
 * İşletmenin aktif müşteri medyan gelirini döndürür.
 * Boş listede 0 döner.
 */
export function computeRevenueMedian(
  customers: SegmentInputCustomer[]
): number {
  if (customers.length === 0) return 0
  const revenues = customers
    .map((c) => c.total_revenue)
    .filter((v) => Number.isFinite(v) && v >= 0)
    .sort((a, b) => a - b)
  if (revenues.length === 0) return 0
  const mid = Math.floor(revenues.length / 2)
  return revenues.length % 2 === 0
    ? (revenues[mid - 1] + revenues[mid]) / 2
    : revenues[mid]
}
