'use client'

import { useState, useEffect } from 'react'
import { Calendar, LayoutGrid, List, Clock, CheckCircle2, XCircle, AlertCircle, CircleDot } from 'lucide-react'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { formatTime, getStatusColor, getInitials, getAvatarColor } from '@/lib/utils'
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

const STATUS_ICONS: Record<string, React.ReactNode> = {
  confirmed:  <CheckCircle2 className="h-4 w-4 text-green-500" />,
  completed:  <CheckCircle2 className="h-4 w-4 text-blue-500" />,
  cancelled:  <XCircle className="h-4 w-4 text-red-400" />,
  no_show:    <AlertCircle className="h-4 w-4 text-orange-400" />,
  pending:    <CircleDot className="h-4 w-4 text-gray-400" />,
}

const STATUS_DOT: Record<string, string> = {
  confirmed: 'bg-green-500',
  completed: 'bg-blue-500',
  cancelled: 'bg-red-400',
  no_show:   'bg-orange-400',
  pending:   'bg-gray-300 dark:bg-gray-600',
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
  const [viewMode, setViewMode] = useViewMode('dashboard-today', 'list')
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
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'list'
                  ? 'bg-pulse-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              title="Liste görünümü"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('box')}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors',
                viewMode === 'box'
                  ? 'bg-pulse-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              )}
              title="Kutu görünümü"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <a
            href="/dashboard/appointments"
            className="text-sm font-medium text-pulse-600 dark:text-pulse-400 hover:text-pulse-700 dark:hover:text-pulse-300 transition-colors"
          >
            Tümünü gör →
          </a>
        </div>
      </div>

      {!appointments || appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
            <Calendar className="h-7 w-7 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bugün randevu yok</p>
          <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Yeni randevu eklemek için randevular sayfasına gidin</p>
        </div>
      ) : viewMode === 'list' ? (
        /* ── Timeline list view ── */
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[26px] top-2 bottom-2 w-px bg-gray-100 dark:bg-gray-800" />

          <div className="space-y-3">
            {appointments.map((apt, i) => {
              const active = isActiveNow(apt, now)
              return (
              <div key={apt.id} className="flex items-start gap-3 group">
                {/* Timeline dot */}
                <div className="relative flex-shrink-0 flex items-center justify-center w-[52px] pt-1">
                  <div className={cn(
                    'h-3 w-3 rounded-full border-2 border-white dark:border-gray-950 z-10',
                    active ? 'bg-green-500 ring-4 ring-green-500/20' : (STATUS_DOT[apt.status] || 'bg-gray-300')
                  )} />
                </div>

                {/* Card */}
                <div className={cn(
                  'flex-1 min-w-0 flex items-center gap-3 rounded-xl px-3 py-2.5',
                  'border border-gray-100 dark:border-gray-800',
                  'bg-white dark:bg-gray-900/50',
                  'group-hover:border-gray-200 dark:group-hover:border-gray-700',
                  'group-hover:shadow-sm transition-all duration-150',
                  active && 'ring-2 ring-green-500/40 border-green-400 dark:border-green-500 bg-green-50/50 dark:bg-green-950/20',
                  apt.status === 'completed' && 'opacity-60',
                  apt.status === 'cancelled' && 'opacity-50',
                )}>
                  {/* Time */}
                  <div className="flex flex-col items-center min-w-[42px] flex-shrink-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatTime(apt.start_time)}
                    </span>
                    <span className="text-[10px] text-gray-400 tabular-nums">
                      {formatTime(apt.end_time)}
                    </span>
                  </div>

                  {/* Divider */}
                  <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 flex-shrink-0" />

                  {/* Avatar */}
                  <div className={cn(
                    'flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg',
                    'text-white text-xs font-bold',
                    getAvatarColor(apt.customers?.name)
                  )}>
                    {getInitials(apt.customers?.name)}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {apt.customers?.name || 'İsimsiz'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {apt.services?.name || 'Hizmet belirtilmemiş'}
                      {apt.staff_members?.name ? ` · ${apt.staff_members.name}` : ''}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    {STATUS_ICONS[apt.status] || STATUS_ICONS.pending}
                  </div>
                </div>
              </div>
            )})}
          </div>
        </div>
      ) : (
        /* ── Box grid view ── */
        <div className="grid gap-3 sm:grid-cols-2">
          {appointments.map((apt) => {
            const active = isActiveNow(apt, now)
            return (
            <div
              key={apt.id}
              className={cn(
                'relative rounded-xl border p-4 transition-all duration-150',
                'border-gray-100 dark:border-gray-800',
                'hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm',
                active && 'ring-2 ring-green-500/40 border-green-400 dark:border-green-500 bg-green-50/30 dark:bg-green-950/20',
                apt.status === 'completed' && 'opacity-70',
                apt.status === 'cancelled' && 'opacity-50',
              )}
            >
              {/* Status indicator stripe */}
              <div className={cn(
                'absolute top-0 left-0 bottom-0 rounded-l-xl',
                active ? 'w-1 bg-green-500' : 'w-0.5',
                !active && (STATUS_DOT[apt.status] || 'bg-gray-300')
              )} />

              <div className="pl-2">
                <div className="flex items-start justify-between mb-2 gap-2">
                  <div className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0',
                    'text-white text-xs font-bold',
                    getAvatarColor(apt.customers?.name)
                  )}>
                    {getInitials(apt.customers?.name)}
                  </div>
                  <span className={`badge text-xs flex-shrink-0 ${getStatusColor(apt.status)}`}>
                    {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>

                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate mb-0.5">
                  {apt.customers?.name || 'İsimsiz'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {apt.services?.name || 'Hizmet belirtilmemiş'}
                </p>
                {apt.staff_members?.name && (
                  <p className="text-xs text-gray-400 mt-1 truncate">{apt.staff_members.name}</p>
                )}

                <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span className="tabular-nums">{formatTime(apt.start_time)} – {formatTime(apt.end_time)}</span>
                </div>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  )
}
