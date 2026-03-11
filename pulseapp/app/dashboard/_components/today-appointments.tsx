'use client'

import { Calendar, LayoutGrid, List } from 'lucide-react'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { formatTime, getStatusColor } from '@/lib/utils'
import { STATUS_LABELS } from '@/types'

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

export default function TodayAppointments({ appointments }: TodayAppointmentsProps) {
  const [viewMode, setViewMode] = useViewMode('dashboard-today', 'list')

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Bugünkü Randevular</h2>
        <div className="flex items-center gap-2">
          {/* Liste/Kutu görünüm toggle */}
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-pulse-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="Liste görünümü"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setViewMode('box')}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium transition-colors ${
                viewMode === 'box'
                  ? 'bg-pulse-500 text-white'
                  : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="Kutu görünümü"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
          <a href="/dashboard/appointments" className="text-sm font-medium text-pulse-600 hover:text-pulse-700">
            Tümünü gör →
          </a>
        </div>
      </div>

      {!appointments || appointments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Calendar className="mb-3 h-10 w-10 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500">Bugün randevu yok</p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="flex items-center gap-4 rounded-lg border border-gray-100 dark:border-gray-700 p-3 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              {/* Saat */}
              <div className="flex flex-col items-center min-w-[52px]">
                <span className="text-lg font-bold text-gray-900">
                  {formatTime(apt.start_time)}
                </span>
                <span className="text-xs text-gray-400">
                  {formatTime(apt.end_time)}
                </span>
              </div>

              {/* Detay */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {apt.customers?.name || 'İsimsiz'}
                </p>
                <p className="text-sm text-gray-500 truncate">
                  {apt.services?.name || 'Hizmet belirtilmemiş'}
                  {apt.staff_members?.name ? ` · ${apt.staff_members.name}` : ''}
                </p>
              </div>

              {/* Durum */}
              <span className={`badge ${getStatusColor(apt.status)}`}>
                {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {appointments.map((apt) => (
            <div
              key={apt.id}
              className="rounded-lg border border-gray-100 dark:border-gray-700 p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-bold text-gray-900">
                  {formatTime(apt.start_time)} – {formatTime(apt.end_time)}
                </span>
                <span className={`badge ${getStatusColor(apt.status)}`}>
                  {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>
              <p className="font-medium text-gray-900 truncate">
                {apt.customers?.name || 'İsimsiz'}
              </p>
              <p className="text-sm text-gray-500 truncate">
                {apt.services?.name || 'Hizmet belirtilmemiş'}
              </p>
              {apt.staff_members?.name && (
                <p className="text-xs text-gray-400 mt-1">{apt.staff_members.name}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
