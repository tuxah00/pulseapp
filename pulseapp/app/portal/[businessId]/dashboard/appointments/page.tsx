'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import {
  CalendarCheck, Clock, Loader2, X, Pencil, Ban, Plus, CalendarX2,
} from 'lucide-react'
import { cn, formatTime, formatDateISO } from '@/lib/utils'
import { useConfirm } from '@/lib/hooks/use-confirm'
import BookingModal from '../_components/booking-modal'
import { SkeletonList } from '../_components/skeleton-card'
import { Portal } from '@/components/ui/portal'

interface ServiceJoin {
  id: string
  name: string
  price?: number
  duration_minutes?: number
}
interface StaffJoin { id: string; name: string }

interface Appointment {
  id: string
  appointment_date: string
  start_time: string
  end_time?: string
  status: string
  notes?: string | null
  services?: ServiceJoin | ServiceJoin[] | null
  staff_members?: StaffJoin | StaffJoin[] | null
}

const TERMINAL_STATUSES = new Set(['cancelled', 'completed', 'no_show'])
const DEFAULT_DURATION_MINUTES = 30

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
  no_show: 'Gelmedi',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  confirmed: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  completed: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  cancelled: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  no_show: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

function formatAppointmentDate(dateStr: string): string {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('tr-TR', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export default function PortalAppointmentsPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const { confirm } = useConfirm()
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [bookingOpen, setBookingOpen] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/portal/appointments?filter=${tab}`)
      if (!res.ok) return
      const data = await res.json()
      setAppointments(data.appointments || [])
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { fetchData() }, [fetchData])

  const handleCancel = async (apt: Appointment) => {
    const svc = Array.isArray(apt.services) ? apt.services[0] : apt.services
    const ok = await confirm({
      title: 'Randevu İptali',
      message: `${svc?.name || 'Randevu'} randevusunu iptal etmek istediğinize emin misiniz?`,
      confirmText: 'İptal Et',
      cancelText: 'Vazgeç',
      variant: 'danger',
    })
    if (!ok) return

    const res = await fetch(`/api/portal/appointments/${apt.id}`, { method: 'DELETE' })
    if (res.ok) {
      fetchData()
    } else {
      const data = await res.json().catch(() => null)
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'İptal başarısız', body: data?.error || 'Bağlantı hatası' },
      }))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Randevularım</h1>
        <button
          type="button"
          onClick={() => setBookingOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-pulse-900 text-white text-sm font-medium hover:bg-pulse-800 transition-colors"
        >
          <Plus className="h-4 w-4" /> Yeni
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl w-fit">
        {(['upcoming', 'past'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-1.5 rounded-lg text-sm font-medium transition-colors',
              tab === t
                ? 'bg-white dark:bg-gray-900 text-pulse-900 dark:text-pulse-300 shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
            )}
          >
            {t === 'upcoming' ? 'Yaklaşan' : 'Geçmiş'}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonList count={3} lines={3} />
      ) : appointments.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
          <div className="h-14 w-14 rounded-full bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center mx-auto mb-3">
            <CalendarX2 className="h-7 w-7 text-pulse-900/50 dark:text-pulse-300" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
            {tab === 'upcoming' ? 'Yaklaşan randevunuz bulunmuyor.' : 'Geçmiş randevunuz bulunmuyor.'}
          </p>
          {tab === 'upcoming' && (
            <button
              type="button"
              onClick={() => setBookingOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-pulse-900 text-white text-sm font-medium hover:bg-pulse-800 transition-colors"
            >
              <Plus className="h-4 w-4" /> Randevu Al
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const svc = Array.isArray(apt.services) ? apt.services[0] : apt.services
            const staff = Array.isArray(apt.staff_members) ? apt.staff_members[0] : apt.staff_members
            const canEdit = tab === 'upcoming' && !TERMINAL_STATUSES.has(apt.status)

            return (
              <div key={apt.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 px-5 flex items-center justify-between gap-3 min-h-[112px]">
                <div className="flex-1 min-w-0 py-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{svc?.name || 'Randevu'}</h3>
                    <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full border flex-shrink-0', STATUS_COLORS[apt.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
                      {STATUS_LABELS[apt.status] || apt.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <CalendarCheck className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      {formatAppointmentDate(apt.appointment_date)}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400 dark:text-gray-500 flex-shrink-0" />
                      {formatTime(apt.start_time)}{apt.end_time && ` - ${formatTime(apt.end_time)}`}
                    </div>
                    <p className={cn('text-xs text-gray-400 dark:text-gray-500', !staff?.name && 'invisible')}>
                      Uzman: {staff?.name || 'placeholder'}
                    </p>
                  </div>
                </div>

                {canEdit && (
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => setEditing(apt)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                    >
                      <Pencil className="h-3 w-3" /> Düzenle
                    </button>
                    <button
                      onClick={() => handleCancel(apt)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                    >
                      <Ban className="h-3 w-3" /> İptal
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {editing && (
        <EditModal
          appointment={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchData() }}
        />
      )}

      <BookingModal
        businessId={businessId}
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onCreated={fetchData}
      />
    </div>
  )
}

function EditModal({ appointment, onClose, onSaved }: {
  appointment: Appointment
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(appointment.appointment_date)
  const [startTime, setStartTime] = useState(appointment.start_time.slice(0, 5))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const svc = Array.isArray(appointment.services) ? appointment.services[0] : appointment.services
  const durationMin = svc?.duration_minutes || DEFAULT_DURATION_MINUTES

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const calcEndTime = (start: string): string => {
    const [h, m] = start.split(':').map(Number)
    const totalMin = h * 60 + m + durationMin
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
  }

  const handleSave = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/portal/appointments/${appointment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          startTime,
          endTime: calcEndTime(startTime),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        const fieldErrors = data.fields ? Object.values(data.fields).filter(Boolean).join(', ') : ''
        setError(fieldErrors || data.error || 'Güncelleme başarısız')
        return
      }
      onSaved()
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setSaving(false)
    }
  }

  const minDate = formatDateISO(new Date())

  return (
    <Portal>
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 modal-overlay">
      <div className="absolute inset-0 bg-black/60 dark:bg-black/70" onClick={onClose} />
      <div className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md modal-content">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Randevuyu Düzenle</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-200">{svc?.name}</span> randevunuz için yeni tarih ve saat seçin.
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Tarih</label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:border-pulse-900 focus:ring-1 focus:ring-pulse-900 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Saat</label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:border-pulse-900 focus:ring-1 focus:ring-pulse-900 outline-none"
            />
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">Bitiş: {calcEndTime(startTime)} ({durationMin} dk)</p>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800 rounded-lg p-2.5">
            Değişiklik sonrası randevunuz işletme onayına gidecektir.
          </p>
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 p-5 border-t border-gray-100 dark:border-gray-800">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">
            Vazgeç
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pulse-900 text-white text-sm font-medium hover:bg-pulse-800 disabled:opacity-70"
          >
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Kaydet
          </button>
        </div>
      </div>
    </div>
    </Portal>
  )
}
