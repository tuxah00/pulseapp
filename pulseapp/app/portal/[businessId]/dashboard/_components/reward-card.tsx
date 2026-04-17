'use client'

import { Gift, Percent, Coins, Sparkles, CalendarClock, CheckCircle2, Clock, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatUntil } from '@/lib/portal/date-helpers'

export interface PortalReward {
  id: string
  status: 'pending' | 'used' | 'expired' | 'cancelled'
  given_at: string
  used_at?: string | null
  expires_at?: string | null
  notes?: string | null
  reward?: {
    id: string
    name: string
    type: 'discount_percent' | 'discount_amount' | 'free_service' | 'points' | 'gift'
    value: number
    description?: string | null
    valid_days?: number | null
  } | {
    id: string
    name: string
    type: string
    value: number
    description?: string | null
    valid_days?: number | null
  }[] | null
}

const REWARD_TYPE_ICONS: Record<string, typeof Gift> = {
  discount_percent: Percent,
  discount_amount: Coins,
  free_service: Sparkles,
  points: Coins,
  gift: Gift,
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Kullanıma Hazır',
  used: 'Kullanıldı',
  expired: 'Süresi Doldu',
  cancelled: 'İptal',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  used: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
  expired: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
}

const STATUS_ICONS: Record<string, typeof CheckCircle2> = {
  pending: Clock,
  used: CheckCircle2,
  expired: XCircle,
  cancelled: XCircle,
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] || null
  return v
}

function formatValue(type: string, value: number): string {
  switch (type) {
    case 'discount_percent':
      return `%${value}`
    case 'discount_amount':
      return `₺${value}`
    case 'points':
      return `${value} puan`
    case 'free_service':
      return 'Ücretsiz'
    case 'gift':
      return 'Hediye'
    default:
      return String(value)
  }
}

interface RewardCardProps {
  reward: PortalReward
  onBook?: () => void
}

export function RewardCard({ reward, onBook }: RewardCardProps) {
  const r = first(reward.reward)
  const type = r?.type || 'gift'
  const Icon = REWARD_TYPE_ICONS[type] || Gift
  const StatusIcon = STATUS_ICONS[reward.status] || Clock
  const isActive = reward.status === 'pending'

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl border p-5 transition-all',
      isActive
        ? 'bg-white dark:bg-gray-900 border-pulse-100 dark:border-pulse-900/40 hover:shadow-md'
        : 'bg-gray-50 dark:bg-gray-900/50 border-gray-100 dark:border-gray-800'
    )}>
      {/* Decorative gradient */}
      {isActive && (
        <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-gradient-to-br from-pulse-900/10 to-indigo-500/10 dark:from-pulse-700/20 dark:to-indigo-500/20 blur-xl pointer-events-none" />
      )}

      <div className="relative flex items-start justify-between gap-3">
        <div className={cn(
          'h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0',
          isActive
            ? 'bg-gradient-to-br from-pulse-900 to-indigo-600 text-white shadow-lg shadow-pulse-900/20'
            : 'bg-gray-200 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
        )}>
          <Icon className="h-6 w-6" />
        </div>
        <span className={cn(
          'inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
          STATUS_COLORS[reward.status] || STATUS_COLORS.pending
        )}>
          <StatusIcon className="h-3 w-3" />
          {STATUS_LABELS[reward.status] || reward.status}
        </span>
      </div>

      <div className="relative mt-4">
        <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          {r?.name || 'Ödül'}
        </p>
        <p className={cn(
          'text-3xl font-bold mt-1',
          isActive ? 'text-pulse-900 dark:text-pulse-300' : 'text-gray-500 dark:text-gray-500'
        )}>
          {r ? formatValue(r.type, r.value) : '—'}
        </p>
        {r?.description && (
          <p className="text-xs text-gray-600 dark:text-gray-300 mt-1.5 line-clamp-2">
            {r.description}
          </p>
        )}
      </div>

      {reward.expires_at && isActive && (
        <div className="relative mt-3 flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <CalendarClock className="h-3 w-3" />
          <span>Son kullanım: {formatUntil(reward.expires_at)}</span>
        </div>
      )}

      {reward.notes && (
        <p className="relative mt-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
          {reward.notes}
        </p>
      )}

      {isActive && onBook && (
        <button
          onClick={onBook}
          className="relative mt-4 w-full px-3 py-2 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-colors"
        >
          Randevu Al ve Kullan
        </button>
      )}
    </div>
  )
}
