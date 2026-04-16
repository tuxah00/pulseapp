'use client'

import { useState } from 'react'
import { Sparkles, Calendar, Image as ImageIcon, User, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ProtocolTimeline, type TimelineSession } from './protocol-timeline'
import { BeforeAfterGallery } from './before-after-gallery'
import type { LightboxPhoto } from './photo-lightbox'

export interface TreatmentProtocol {
  id: string
  name: string
  total_sessions: number
  completed_sessions: number
  status: string
  notes?: string | null
  service?: { id: string; name: string } | { id: string; name: string }[] | null
  staff?: { id: string; name: string } | { id: string; name: string }[] | null
  sessions: TimelineSession[]
  photos: (LightboxPhoto & { session_id?: string | null })[]
}

const STATUS_LABELS: Record<string, string> = {
  active: 'Devam ediyor',
  completed: 'Tamamlandı',
  paused: 'Duraklatıldı',
  cancelled: 'İptal',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  completed: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  paused: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] || null
  return v
}

interface TreatmentProgressCardProps {
  protocol: TreatmentProtocol
}

export function TreatmentProgressCard({ protocol }: TreatmentProgressCardProps) {
  const [tab, setTab] = useState<'timeline' | 'photos'>('timeline')
  const [expanded, setExpanded] = useState(true)

  const service = first(protocol.service)
  const staff = first(protocol.staff)

  const progress = protocol.total_sessions > 0
    ? Math.round((protocol.completed_sessions / protocol.total_sessions) * 100)
    : 0

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
              {protocol.name}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500 dark:text-gray-400">
              {service?.name && (
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> {service.name}
                </span>
              )}
              {staff?.name && (
                <span className="inline-flex items-center gap-1">
                  <User className="h-3 w-3" /> {staff.name}
                </span>
              )}
            </div>
          </div>
          <span className={cn(
            'text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap',
            STATUS_COLORS[protocol.status] || STATUS_COLORS.active
          )}>
            {STATUS_LABELS[protocol.status] || protocol.status}
          </span>
        </div>

        {/* İlerleme */}
        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <p className="text-xs text-gray-500 dark:text-gray-400">İlerleme</p>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {protocol.completed_sessions} / {protocol.total_sessions}
              <span className="ml-2 text-xs font-normal text-pulse-900 dark:text-pulse-300">
                %{progress}
              </span>
            </p>
          </div>
          <div className="h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pulse-900 to-indigo-600 transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {protocol.notes && (
          <p className="mt-3 text-xs text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-gray-800/50 rounded-lg p-2.5">
            {protocol.notes}
          </p>
        )}
      </div>

      <div className="border-t border-gray-100 dark:border-gray-800">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-2.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
        >
          <span>{expanded ? 'Detayları gizle' : 'Detayları göster'}</span>
          <ChevronDown className={cn('h-4 w-4 transition-transform', expanded && 'rotate-180')} />
        </button>

        {expanded && (
          <div className="px-5 pb-5">
            {/* Tabs */}
            <div className="inline-flex rounded-lg bg-gray-100 dark:bg-gray-800 p-1 mb-3">
              <button
                onClick={() => setTab('timeline')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                  tab === 'timeline'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                Zaman Çizelgesi
              </button>
              <button
                onClick={() => setTab('photos')}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5',
                  tab === 'photos'
                    ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" />
                Öncesi / Sonrası
                {protocol.photos.length > 0 && (
                  <span className="text-[10px] px-1.5 rounded-full bg-pulse-900/10 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300">
                    {protocol.photos.length}
                  </span>
                )}
              </button>
            </div>

            {tab === 'timeline' ? (
              <ProtocolTimeline sessions={protocol.sessions} />
            ) : (
              <BeforeAfterGallery photos={protocol.photos} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}
