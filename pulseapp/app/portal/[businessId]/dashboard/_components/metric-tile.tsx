'use client'

import { cn } from '@/lib/utils'

interface MetricTileProps {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  subtitle?: string
  accent?: 'pulse' | 'emerald' | 'amber' | 'indigo'
}

const ACCENT_CLASSES: Record<string, { bg: string; text: string }> = {
  pulse: { bg: 'bg-pulse-900/10 dark:bg-pulse-900/30', text: 'text-pulse-900 dark:text-pulse-300' },
  emerald: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300' },
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
  indigo: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-700 dark:text-indigo-300' },
}

export function MetricTile({ icon: Icon, label, value, subtitle, accent = 'pulse' }: MetricTileProps) {
  const c = ACCENT_CLASSES[accent]
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
      <div className={cn('inline-flex h-9 w-9 rounded-xl items-center justify-center', c.bg)}>
        <Icon className={cn('h-4 w-4', c.text)} />
      </div>
      <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mt-3">
        {label}
      </p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-0.5">
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
      )}
    </div>
  )
}
