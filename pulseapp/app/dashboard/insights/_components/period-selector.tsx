'use client'

import type { ReactNode } from 'react'

/**
 * Pill toggle — haftalık / aylık / mevsimsel kırılım için.
 * Doluluk endpoint'i `?period=weekly|monthly|seasonal` param'ı kabul eder.
 */

export type PeriodKey = 'weekly' | 'monthly' | 'seasonal'

const OPTIONS: { key: PeriodKey; label: string; description: string }[] = [
  { key: 'weekly', label: 'Haftalık', description: 'Son 12 hafta' },
  { key: 'monthly', label: 'Aylık', description: 'Son 12 ay' },
  { key: 'seasonal', label: 'Mevsimsel', description: 'Mevsim ortalaması' },
]

interface Props {
  value: PeriodKey
  onChange: (value: PeriodKey) => void
  /** Opsiyonel — özel seçenek listesi */
  options?: { key: PeriodKey; label: string; description?: string }[]
  /** Opsiyonel — sağda özet metin / badge */
  trailing?: ReactNode
}

export default function PeriodSelector({
  value,
  onChange,
  options = OPTIONS,
  trailing,
}: Props) {
  return (
    <div className="flex items-center gap-2">
      <div
        role="tablist"
        aria-label="Dönem"
        className="inline-flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 p-0.5"
      >
        {options.map((opt) => {
          const active = opt.key === value
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              title={opt.description}
              onClick={() => onChange(opt.key)}
              className={`text-xs font-medium px-3 py-1 rounded-md transition-colors ${
                active
                  ? 'bg-pulse-900 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-pulse-900 dark:hover:text-pulse-300'
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
      {trailing}
    </div>
  )
}
