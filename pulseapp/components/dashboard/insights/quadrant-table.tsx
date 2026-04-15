'use client'

import type { ServiceMarginRow, Quadrant } from '@/lib/analytics/insights'
import { formatCurrency } from '@/lib/utils'

interface Props {
  rows: ServiceMarginRow[]
}

const QUAD_LABEL: Record<Quadrant, { label: string; tone: string; desc: string }> = {
  star: {
    label: 'Kazandıran Hizmetler',
    tone: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
    desc: 'Hem çok satılıyor hem yüksek bilet — öne çıkar',
  },
  cash_cow: {
    label: 'Popüler Hizmetler',
    tone: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
    desc: 'Çok satılan ama bileti düşük — hacim geliri',
  },
  question: {
    label: 'Büyüme Fırsatı',
    tone: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    desc: 'Bileti yüksek ama az satılıyor — pazarlamayla büyür',
  },
  dog: {
    label: 'Zayıf Satanlar',
    tone: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
    desc: 'Az satılıyor ve bileti düşük — gözden geçir',
  },
}

export default function QuadrantTable({ rows }: Props) {
  if (!rows || rows.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
        Bu dönemde hizmet satışı yok.
      </div>
    )
  }

  const buckets: Record<Quadrant, ServiceMarginRow[]> = {
    star: [], cash_cow: [], question: [], dog: [],
  }
  rows.forEach(r => buckets[r.quadrant].push(r))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {(['star', 'cash_cow', 'question', 'dog'] as Quadrant[]).map(q => {
        const info = QUAD_LABEL[q]
        const list = buckets[q]
        return (
          <div key={q} className="card p-3 cursor-default">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${info.tone}`}>
                {info.label}
              </span>
              <span className="text-[11px] text-gray-500 dark:text-gray-400">{list.length} hizmet</span>
            </div>
            <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">{info.desc}</div>
            {list.length === 0 ? (
              <div className="text-xs text-gray-400 dark:text-gray-500 italic py-2">—</div>
            ) : (
              <ul className="space-y-1">
                {list.slice(0, 5).map((r, i) => (
                  <li key={i} className="flex items-center justify-between text-xs gap-2">
                    <span className="truncate text-gray-700 dark:text-gray-300">{r.service_name}</span>
                    <span className="text-gray-500 dark:text-gray-400 shrink-0">
                      {formatCurrency(r.revenue)}
                    </span>
                  </li>
                ))}
                {list.length > 5 && (
                  <li className="text-[11px] text-gray-400 dark:text-gray-500 italic">
                    +{list.length - 5} daha
                  </li>
                )}
              </ul>
            )}
          </div>
        )
      })}
    </div>
  )
}
