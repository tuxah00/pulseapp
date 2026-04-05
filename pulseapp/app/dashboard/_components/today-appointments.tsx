'use client'

import { useState, useEffect } from 'react'
import { Calendar, Clock, CheckCircle2, XCircle, AlertCircle, CircleDot, ArrowRight } from 'lucide-react'
import { formatTime, getInitials, getAvatarColor } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'
import { cn } from '@/lib/utils'

interface Appointment {
  id: string
  start_time: string
  end_time: string
  status: string
  customers?: { name: string; phone?: string } | null
  services?: { name: string } | null
  staff_members?: { name: string } | null
}

interface TodayAppointmentsProps {
  appointments: Appointment[]
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; bg: string; dot: string; label: string }> = {
  confirmed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', dot: 'bg-green-500', label: 'Onaylandı' },
  completed: { icon: CheckCircle2, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20', dot: 'bg-blue-500', label: 'Tamamlandı' },
  cancelled: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', dot: 'bg-red-400', label: 'İptal' },
  no_show:   { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', dot: 'bg-orange-400', label: 'Gelmedi' },
  pending:   { icon: CircleDot, color: 'text-gray-400', bg: 'bg-gray-50 dark:bg-gray-800', dot: 'bg-gray-300 dark:bg-gray-600', label: 'Bekliyor' },
}

function isActiveNow(apt: Appointment, now: Date): boolean {
  if (apt.status === 'completed' || apt.status === 'cancelled' || apt.status === 'no_show') return false
  if (!apt.start_time || !apt.end_time) return false
  const [sh, sm] = apt.start_time.split(':').map(Number)
  const [eh, em] = apt.end_time.split(':').map(Number)
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  return nowMinutes >= sh * 60 + sm && nowMinutes < eh * 60 + em
}

export default function TodayAppointments({ appointments }: TodayAppointmentsProps) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className="card h-full">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Bugünkü Randevular</h2>
          {appointments.length > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">{appointments.length} randevu</p>
          )}
        </div>
        <a
          href="/dashboard/appointments"
          className="flex items-center gap-1 text-sm font-medium text-pulse-600 dark:text-pulse-400 hover:text-pulse-700 dark:hover:text-pulse-300 transition-colors"
        >
          Tümünü gör <ArrowRight className="h-3.5 w-3.5" />
        </a>
      </div>

      {!appointments || appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
            <Calendar className="h-7 w-7 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bugün randevu yok</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Yeni randevu eklemek için randevular sayfasına gidin</p>
        </div>
      ) : (
        <div className="space-y-2">
          {appointments.map((apt) => {
            const active = isActiveNow(apt, now)
            const config = STATUS_CONFIG[apt.status] || STATUS_CONFIG.pending
            const StatusIcon = config.icon
            const isDone = apt.status === 'completed' || apt.status === 'cancelled'

            return (
              <div
                key={apt.id}
                className={cn(
                  'group relative flex items-center gap-3 rounded-xl px-3.5 py-3 transition-all duration-150',
                  'border',
                  active
                    ? 'border-green-400/60 dark:border-green-500/40 bg-green-50/60 dark:bg-green-950/20 shadow-sm shadow-green-500/10'
                    : 'border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50/50 dark:hover:bg-gray-800/30',
                  isDone && 'opacity-55',
                )}
              >
                {/* Active pulse indicator */}
                {active && (
                  <div className="absolute -left-px top-1/2 -translate-y-1/2 w-[3px] h-8 rounded-full bg-green-500" />
                )}

                {/* Time block */}
                <div className="flex-shrink-0 w-[56px] text-center">
                  <p className={cn(
                    'text-sm font-bold tabular-nums',
                    active ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-100'
                  )}>
                    {formatTime(apt.start_time)}
                  </p>
                  <p className="text-[10px] text-gray-400 tabular-nums mt-0.5">
                    {formatTime(apt.end_time)}
                  </p>
                </div>

                {/* Separator */}
                <div className={cn(
                  'w-px h-9 flex-shrink-0 rounded-full',
                  active ? 'bg-green-300 dark:bg-green-700' : 'bg-gray-150 dark:bg-gray-750',
                  !active && 'bg-gray-200 dark:bg-gray-700'
                )} />

                {/* Avatar */}
                <div className={cn(
                  'flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl',
                  'text-white text-xs font-bold shadow-sm',
                  getAvatarColor(apt.customers?.name)
                )}>
                  {getInitials(apt.customers?.name)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate leading-tight">
                    {apt.customers?.name || 'İsimsiz'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {apt.services?.name || 'Hizmet belirtilmemiş'}
                    {apt.staff_members?.name ? ` · ${apt.staff_members.name}` : ''}
                  </p>
                </div>

                {/* Status badge */}
                <div className={cn(
                  'flex-shrink-0 flex items-center gap-1 rounded-lg px-2 py-1',
                  config.bg
                )}>
                  <StatusIcon className={cn('h-3.5 w-3.5', config.color)} />
                  <span className={cn('text-[11px] font-medium', config.color)}>
                    {config.label}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
