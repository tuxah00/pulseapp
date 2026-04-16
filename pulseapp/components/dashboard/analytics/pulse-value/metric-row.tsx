'use client'

import type { VALUE_METHOD_DESCRIPTIONS } from '@/lib/analytics/pulse-value-methods'
import { ValueMethodPopup } from './value-method-popup'

interface MetricRowProps {
  label: string
  count: number
  secondary?: string
  methodKey: keyof typeof VALUE_METHOD_DESCRIPTIONS
  detail?: string
  icon?: React.ReactNode
}

export function MetricRow({ label, count, secondary, methodKey, detail, icon }: MetricRowProps) {
  const isEmpty = count === 0

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800/50 cursor-default ${isEmpty ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-pulse-900 dark:text-pulse-400 shrink-0">{icon}</span>}
        <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{label}</span>
        <ValueMethodPopup methodKey={methodKey} detail={detail} />
      </div>
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {count.toLocaleString('tr-TR')}
        </span>
        {secondary && (
          <span className="text-xs text-pulse-900 dark:text-pulse-400 font-medium tabular-nums">
            {secondary}
          </span>
        )}
      </div>
    </div>
  )
}
