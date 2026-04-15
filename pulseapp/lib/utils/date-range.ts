/**
 * Tarih aralığı yardımcıları.
 *
 * 1) `to = "2026-04-15"` (YYYY-MM-DD) bir timestamptz kolonu ile
 *    `.lte('created_at', to)` olarak kullanılırsa Postgres bunu
 *    `2026-04-15 00:00:00+00` olarak yorumlar → o günün tamamı kaçırılır.
 *    `toInclusiveEnd()` gün sonuna kadar genişletir.
 *
 * 2) JS'te `date.setMonth(m)` ay taşmasına neden olur: Mart 31'de `setMonth(1)`
 *    çağırılırsa 31 Şubat → 3 Mart'a döner. `addMonthsSafe()` önce `setDate(1)`
 *    yaparak bunu engeller ve ardından günü son güne clamp eder.
 */

export function toInclusiveEnd(ymd: string | null | undefined): string | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null
  return `${ymd}T23:59:59.999Z`
}

/**
 * `date`'in `months` kadar ilerlemiş/gerilemiş kopyasını döndürür.
 * Taşma güvenli: 31 Ocak + 1 ay = 28/29 Şubat (3 Mart değil).
 */
export function addMonthsSafe(date: Date, months: number): Date {
  const d = new Date(date)
  const originalDay = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + months)
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(originalDay, lastDay))
  return d
}
