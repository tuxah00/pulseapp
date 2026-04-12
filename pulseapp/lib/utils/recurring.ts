/**
 * Tekrarlayan gelir/gider kayıtlarını belirli dönem aralığında açar.
 *
 * DB'ye yazma yapmaz — sadece analitik görüntüleme için sentetik kayıtlar üretir.
 */

interface RecurringItem {
  id: string
  amount: number
  expense_date?: string   // gider
  income_date?: string    // gelir
  is_recurring?: boolean
  recurring_period?: string | null
  custom_interval_days?: number | null
}

interface ExpandedItem {
  id: string
  amount: number
  date: string
  isExpanded: boolean     // true = sentetik kayıt
}

function getIntervalDays(period: string, customDays?: number | null): number {
  switch (period) {
    case 'weekly':    return 7
    case 'biweekly':  return 14
    case 'monthly':   return 30
    case 'quarterly': return 91
    case 'yearly':    return 365
    case 'custom':    return customDays || 30
    default:          return 30
  }
}

export function expandRecurring<T extends RecurringItem>(
  items: T[],
  periodStart: string,
  periodEnd: string,
): ExpandedItem[] {
  const result: ExpandedItem[] = []
  const startMs = new Date(periodStart).getTime()
  const endMs = new Date(periodEnd + 'T23:59:59').getTime()

  for (const item of items) {
    const itemDate = item.expense_date || item.income_date || ''
    if (!itemDate) continue

    // Orijinal kayıt dönem içindeyse ekle
    const dateMs = new Date(itemDate).getTime()
    if (dateMs >= startMs && dateMs <= endMs) {
      result.push({ id: item.id, amount: item.amount, date: itemDate, isExpanded: false })
    }

    // Tekrarlayan değilse devam
    if (!item.is_recurring || !item.recurring_period) continue

    const intervalDays = getIntervalDays(item.recurring_period, item.custom_interval_days)
    const intervalMs = intervalDays * 24 * 60 * 60 * 1000

    // İlk kayıttan sonraki tekrarları üret
    let nextMs = dateMs + intervalMs
    let safety = 0
    while (nextMs <= endMs && safety < 365) {
      if (nextMs >= startMs) {
        const d = new Date(nextMs)
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
        result.push({ id: item.id, amount: item.amount, date: dateStr, isExpanded: true })
      }
      nextMs += intervalMs
      safety++
    }
  }

  return result
}
