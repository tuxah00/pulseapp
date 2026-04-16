'use client'

import { Clock, Wallet, UserPlus } from 'lucide-react'
import { formatCurrency, formatEstimatedDuration } from '@/lib/utils'
import type { VALUE_METHOD_DESCRIPTIONS } from '@/lib/analytics/pulse-value-methods'
import { ValueMethodPopup } from './value-method-popup'

type MethodKey = keyof typeof VALUE_METHOD_DESCRIPTIONS

interface SummaryStatsProps {
  savedMinutes: number
  savedMoneyEstimate: number
  digitalRevenue: number
  newReturningCustomers: number
}

export function SummaryStats({
  savedMinutes,
  savedMoneyEstimate,
  digitalRevenue,
  newReturningCustomers,
}: SummaryStatsProps) {
  const cards: Array<{
    key: MethodKey
    label: string
    value: string
    subValue: string
    subKey?: MethodKey
    icon: React.ReactNode
    color: string
  }> = [
    {
      key: 'saved_time',
      label: 'Kazandırılan Zaman',
      value: formatEstimatedDuration(savedMinutes),
      subValue: `~${formatCurrency(savedMoneyEstimate)} zaman değeri`,
      subKey: 'saved_money',
      icon: <Clock className="h-5 w-5" />,
      color: 'from-violet-500/10 to-violet-500/0',
    },
    {
      key: 'digital_revenue',
      label: 'Dijital Kanal Geliri',
      value: formatCurrency(digitalRevenue),
      subValue: 'Online + AI + gap-fill + kampanya',
      icon: <Wallet className="h-5 w-5" />,
      color: 'from-emerald-500/10 to-emerald-500/0',
    },
    {
      key: 'new_returning',
      label: 'Yeni / Geri Dönen Müşteri',
      value: `${newReturningCustomers} kişi`,
      subValue: 'Referans + winback',
      icon: <UserPlus className="h-5 w-5" />,
      color: 'from-amber-500/10 to-amber-500/0',
    },
  ]

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {cards.map(card => (
        <div
          key={card.key}
          className={`card p-4 relative overflow-hidden bg-gradient-to-br ${card.color}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-400">
                {card.icon}
              </div>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {card.label}
              </span>
            </div>
            <ValueMethodPopup methodKey={card.key} />
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-pulse-900 dark:text-pulse-400 tabular-nums">
              {card.value}
            </div>
            <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
              {card.subValue}
              {card.subKey && <ValueMethodPopup methodKey={card.subKey} />}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
