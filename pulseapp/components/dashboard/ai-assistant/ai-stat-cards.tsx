'use client'

import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import type { AIBlockStatCards, AIBlockStatCard } from '@/types'

interface Props {
  block: AIBlockStatCards
}

export default function AIStatCards({ block }: Props) {
  return (
    <div className="w-full">
      {block.title && (
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
          {block.title}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {block.cards.map((card, i) => (
          <StatCard key={i} card={card} />
        ))}
      </div>
    </div>
  )
}

function StatCard({ card }: { card: AIBlockStatCard }) {
  const tone = card.tone || 'default'
  const toneClasses =
    tone === 'positive'
      ? 'border-green-200 dark:border-green-800/60 bg-green-50/50 dark:bg-green-900/10'
      : tone === 'negative'
      ? 'border-red-200 dark:border-red-800/60 bg-red-50/50 dark:bg-red-900/10'
      : tone === 'warning'
      ? 'border-amber-200 dark:border-amber-800/60 bg-amber-50/50 dark:bg-amber-900/10'
      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'

  return (
    <div className={`rounded-xl border p-3 ${toneClasses}`}>
      <div className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">{card.label}</div>
      <div className="flex items-baseline gap-1.5">
        <div className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
          {card.value}
        </div>
        {card.delta != null && <Delta value={card.delta} />}
      </div>
      {card.hint && (
        <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{card.hint}</div>
      )}
    </div>
  )
}

function Delta({ value }: { value: number }) {
  const positive = value > 0
  const negative = value < 0
  const Icon = positive ? ArrowUpRight : negative ? ArrowDownRight : Minus
  const cls = positive
    ? 'text-green-700 dark:text-green-300'
    : negative
    ? 'text-red-700 dark:text-red-300'
    : 'text-gray-500'
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium tabular-nums ${cls}`}>
      <Icon className="w-3 h-3" />
      {positive ? '+' : ''}{value}%
    </span>
  )
}
