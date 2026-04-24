// ================================================
// lib/insights/date-range.ts
// API endpoint'leri için ortak dönem hesabı
// ================================================
// İş Zekası endpoint'leri ya ?from=&to= ile açık aralık alır ya da ?days=30
// varsayılanıyla çalışır. Bu helper ikisini de standardize eder.

import { toInclusiveEnd } from '@/lib/utils/date-range'

export interface InsightsDateRange {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  fromIso: string // ISO timestamp (UTC başlangıç)
  toIso: string // ISO timestamp (UTC gün sonu dahil)
  days: number
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DAYS = 30

export function resolveDateRange(searchParams: URLSearchParams): InsightsDateRange {
  const fromParam = searchParams.get('from')
  const toParam = searchParams.get('to')
  const daysParam = Number(searchParams.get('days'))
  const days =
    Number.isFinite(daysParam) && daysParam > 0 && daysParam <= 365
      ? daysParam
      : DEFAULT_DAYS

  const now = new Date()
  const toDate = toParam && /^\d{4}-\d{2}-\d{2}$/.test(toParam)
    ? new Date(toParam)
    : now
  const fromDate = fromParam && /^\d{4}-\d{2}-\d{2}$/.test(fromParam)
    ? new Date(fromParam)
    : new Date(toDate.getTime() - days * DAY_MS)

  const from = ymd(fromDate)
  const to = ymd(toDate)
  return {
    from,
    to,
    fromIso: `${from}T00:00:00.000Z`,
    toIso: toInclusiveEnd(to) ?? `${to}T23:59:59.999Z`,
    days: Math.max(1, Math.round((toDate.getTime() - fromDate.getTime()) / DAY_MS)),
  }
}

function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
