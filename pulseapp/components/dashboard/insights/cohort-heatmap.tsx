'use client'

import type { CohortCell } from '@/lib/analytics/insights'

interface Props {
  cohort: CohortCell[]
}

function rateColor(rate: number): string {
  // rate 0..1 aralığında — yeşil tonu: yüksek = koyu yeşil, düşük = soluk
  if (rate >= 0.5) return 'bg-emerald-500 text-white'
  if (rate >= 0.3) return 'bg-emerald-300 text-emerald-900'
  if (rate >= 0.15) return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
  if (rate > 0) return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400'
  return 'bg-gray-50 text-gray-400 dark:bg-gray-900 dark:text-gray-600'
}

function monthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  if (!y || !m) return ym
  const months = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara']
  return `${months[m - 1]} ${String(y).slice(2)}`
}

export default function CohortHeatmap({ cohort }: Props) {
  if (!cohort || cohort.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        Kohort verisi hesaplanamadı.
      </div>
    )
  }

  const maxOffset = Math.max(
    ...cohort.flatMap(c => c.retention.map(r => r.month_offset)),
    1,
  )
  const offsets = Array.from({ length: maxOffset + 1 }, (_, i) => i)

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="text-gray-500 dark:text-gray-400">
            <th className="text-left px-2 py-1 font-medium sticky left-0 bg-white dark:bg-gray-900">Kohort</th>
            <th className="text-center px-2 py-1 font-medium">Boyut</th>
            {offsets.map(o => (
              <th key={o} className="text-center px-2 py-1 font-medium">
                {o === 0 ? 'Ay 0' : `+${o} ay`}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohort.map(c => {
            const retMap = new Map(c.retention.map(r => [r.month_offset, r]))
            return (
              <tr key={c.cohort_month}>
                <td className="px-2 py-1 text-gray-700 dark:text-gray-300 sticky left-0 bg-white dark:bg-gray-900">
                  {monthLabel(c.cohort_month)}
                </td>
                <td className="text-center px-2 py-1 text-gray-500 dark:text-gray-400">
                  {c.cohort_size}
                </td>
                {offsets.map(o => {
                  const cell = retMap.get(o)
                  if (!cell) {
                    return <td key={o} className="px-1 py-1"><div className="h-7" /></td>
                  }
                  return (
                    <td key={o} className="px-1 py-1">
                      <div
                        className={`h-7 rounded flex items-center justify-center font-medium ${rateColor(cell.rate)}`}
                        title={`${cell.returning}/${c.cohort_size} müşteri geri döndü`}
                      >
                        {(cell.rate * 100).toFixed(0)}%
                      </div>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
