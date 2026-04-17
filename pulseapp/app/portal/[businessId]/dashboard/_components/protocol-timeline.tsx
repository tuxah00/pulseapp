'use client'

import { Check, Clock, X as XIcon, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface TimelineSession {
  id: string
  session_number: number
  status: string
  planned_date: string | null
  completed_date: string | null
  notes?: string | null
  appointment?: {
    id: string
    appointment_date: string
    start_time: string
    end_time?: string
  } | null
}

const STATUS_STYLES: Record<string, { icon: typeof Check; dot: string; ring: string; label: string; text: string }> = {
  completed: {
    icon: Check,
    dot: 'bg-green-500 dark:bg-green-400',
    ring: 'ring-green-200 dark:ring-green-900/50',
    label: 'Tamamlandı',
    text: 'text-green-700 dark:text-green-300',
  },
  planned: {
    icon: Clock,
    dot: 'bg-gray-300 dark:bg-gray-600',
    ring: 'ring-gray-100 dark:ring-gray-800',
    label: 'Planlandı',
    text: 'text-gray-600 dark:text-gray-400',
  },
  skipped: {
    icon: XIcon,
    dot: 'bg-red-400 dark:bg-red-500',
    ring: 'ring-red-100 dark:ring-red-900/50',
    label: 'Atlandı',
    text: 'text-red-700 dark:text-red-400',
  },
  cancelled: {
    icon: XIcon,
    dot: 'bg-gray-400 dark:bg-gray-500',
    ring: 'ring-gray-100 dark:ring-gray-800',
    label: 'İptal',
    text: 'text-gray-500 dark:text-gray-400',
  },
}

function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  try {
    return new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return d
  }
}

interface ProtocolTimelineProps {
  sessions: TimelineSession[]
}

export function ProtocolTimeline({ sessions }: ProtocolTimelineProps) {
  if (sessions.length === 0) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400 text-center py-6">
        Henüz seans planlanmamış.
      </div>
    )
  }

  return (
    <ol className="relative">
      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-800" aria-hidden />
      {sessions.map((s, idx) => {
        const style = STATUS_STYLES[s.status] || STATUS_STYLES.planned
        const Icon = style.icon
        const date = s.completed_date || s.planned_date || s.appointment?.appointment_date
        return (
          <li key={s.id} className={cn('relative flex items-start gap-3', idx < sessions.length - 1 && 'pb-5')}>
            <div className={cn(
              'relative z-10 flex h-6 w-6 items-center justify-center rounded-full ring-4 flex-shrink-0',
              style.dot,
              style.ring,
            )}>
              <Icon className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="flex-1 min-w-0 pt-0.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {s.session_number}. Seans
                </p>
                <span className={cn('text-[11px] font-medium', style.text)}>
                  {style.label}
                </span>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(date)}</p>
              {s.notes && (
                <p className="text-xs text-gray-600 dark:text-gray-300 mt-1 bg-gray-50 dark:bg-gray-800/50 rounded-md px-2 py-1.5">
                  {s.notes}
                </p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Boş durumlarda placeholder — "Henüz seans yok"
 */
export function TimelineEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <Circle className="h-8 w-8 text-gray-300 dark:text-gray-700 mb-2" />
      <p className="text-sm text-gray-500 dark:text-gray-400">Henüz seans planlanmamış.</p>
    </div>
  )
}
