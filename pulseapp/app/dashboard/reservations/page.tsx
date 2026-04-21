'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import {
  Plus,
  Loader2,
  ChevronLeft,
  ChevronRight,
  X,
  Users,
  Trash2,
  Pencil,
  CalendarCheck,
  Phone,
  LayoutList,
  LayoutGrid,
  ArrowUpDown,
} from 'lucide-react'
import { cn, formatDateISO } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import CompactBoxCard from '@/components/ui/compact-box-card'

type ReservationStatus = 'pending' | 'confirmed' | 'seated' | 'completed' | 'cancelled' | 'no_show'

interface TableReservation {
  id: string
  business_id: string
  customer_name: string
  customer_phone: string
  customer_id: string | null
  reservation_date: string
  reservation_time: string
  party_size: number
  table_number: string | null
  status: ReservationStatus
  notes: string | null
  source: string
  created_at: string
}

const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  seated: 'Oturdu',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  no_show: 'Gelmedi',
}

const STATUS_COLORS: Record<ReservationStatus, string> = {
  pending: 'badge-warning',
  confirmed: 'badge-info',
  seated: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'badge-success',
  cancelled: 'badge-neutral',
  no_show: 'badge-danger',
}

function formatDateTR(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

function formatTime(timeStr: string) {
  return timeStr.slice(0, 5)
}

export default function ReservationsPage() {
  const { businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const [reservations, setReservations] = useState<TableReservation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()))
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingReservation, setEditingReservation] = useState<TableReservation | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('reservations', 'list')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const { confirm } = useConfirm()

  // Form state
  const [formCustomerName, setFormCustomerName] = useState('')
  const [formCustomerPhone, setFormCustomerPhone] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTime, setFormTime] = useState('19:00')
  const [formPartySize, setFormPartySize] = useState(2)
  const [formTableNumber, setFormTableNumber] = useState('')
  const [formNotes, setFormNotes] = useState('')

  const fetchReservations = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/reservations?businessId=${businessId}&date=${selectedDate}`)
      const json = await res.json()
      if (json.reservations) setReservations(json.reservations)
    } catch (e) {
      console.error('Rezervasyon çekme hatası:', e)
    }
    setLoading(false)
  }, [businessId, selectedDate])

  useEffect(() => {
    if (!ctxLoading) fetchReservations()
  }, [fetchReservations, ctxLoading])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  function changeDate(days: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(formatDateISO(d))
  }

  function goToday() {
    setSelectedDate(formatDateISO(new Date()))
  }

  function openNewModal() {
    setEditingReservation(null)
    setFormCustomerName('')
    setFormCustomerPhone('')
    setFormDate(selectedDate)
    setFormTime('19:00')
    setFormPartySize(2)
    setFormTableNumber('')
    setFormNotes('')
    setError(null)
    setShowModal(true)
  }

  function openEditModal(r: TableReservation) {
    setEditingReservation(r)
    setFormCustomerName(r.customer_name)
    setFormCustomerPhone(r.customer_phone)
    setFormDate(r.reservation_date)
    setFormTime(r.reservation_time.slice(0, 5))
    setFormPartySize(r.party_size)
    setFormTableNumber(r.table_number ?? '')
    setFormNotes(r.notes ?? '')
    setError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!businessId) return
    if (!formCustomerName.trim()) { setError(`${getCustomerLabelSingular(sector ?? undefined)} adı zorunludur.`); return }
    if (!formCustomerPhone.trim()) { setError('Telefon numarası zorunludur.'); return }
    if (!formDate) { setError('Tarih zorunludur.'); return }
    if (!formTime) { setError('Saat zorunludur.'); return }
    if (formPartySize < 1) { setError('Kişi sayısı en az 1 olmalıdır.'); return }

    setSaving(true)
    setError(null)

    const payload = {
      business_id: businessId,
      customer_name: formCustomerName.trim(),
      customer_phone: formCustomerPhone.trim(),
      reservation_date: formDate,
      reservation_time: formTime,
      party_size: formPartySize,
      table_number: formTableNumber.trim() || null,
      notes: formNotes.trim() || null,
    }

    try {
      if (editingReservation) {
        const res = await fetch(`/api/reservations?id=${editingReservation.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.error) { setError(json.error); setSaving(false); return }
      } else {
        const res = await fetch('/api/reservations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const json = await res.json()
        if (json.error) { setError(json.error); setSaving(false); return }
      }
      closeModal()
      fetchReservations()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: editingReservation ? 'Kaydedildi' : 'Oluşturuldu' } }))
    } catch (e) {
      setError('Bir hata oluştu.')
    }
    setSaving(false)
  }

  async function updateStatus(id: string, status: ReservationStatus) {
    try {
      await fetch(`/api/reservations?id=${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      fetchReservations()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    } catch (e) {
      console.error('Status güncelleme hatası:', e)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu rezervasyonu silmek istediğinize emin misiniz?' })
    if (!ok) return
    try {
      await fetch(`/api/reservations?id=${id}`, { method: 'DELETE' })
      fetchReservations()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
    } catch (e) {
      console.error('Silme hatası:', e)
    }
  }

  // Stats for selected date
  const total = reservations.length
  const confirmed = reservations.filter(r => r.status === 'confirmed').length
  const seated = reservations.filter(r => r.status === 'seated').length
  const noShow = reservations.filter(r => r.status === 'no_show').length

  const isToday = selectedDate === formatDateISO(new Date())

  const SORT_OPTIONS = [
    { value: 'reservation_time', label: 'Saat' },
    { value: 'customer_name', label: `${getCustomerLabelSingular(sector ?? undefined)} adı` },
    { value: 'party_size', label: 'Misafir sayısı' },
  ]

  const sortedReservations = sortField
    ? [...reservations].sort((a, b) => {
        const va = (a as any)[sortField]
        const vb = (b as any)[sortField]
        if (va == null && vb == null) return 0
        if (va == null) return 1; if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : reservations

  requireSectorModule(sector, 'reservations')
  requirePermission(permissions, 'reservations')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Rezervasyonlar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Masa rezervasyonlarını yönetin</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
            <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
              <SortPopoverContent options={SORT_OPTIONS} sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir} />
            </ToolbarPopover>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutu"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button
            onClick={openNewModal}
            className="flex items-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Yeni Rezervasyon
          </button>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => changeDate(-1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{formatDateTR(selectedDate)}</span>
          {isToday && (
            <span className="ml-2 badge-brand">
              Bugün
            </span>
          )}
        </div>
        <button
          onClick={() => changeDate(1)}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {!isToday && (
          <button
            onClick={goToday}
            className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Bugün
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
          <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{total}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Onaylı</p>
          <p className="mt-1 text-2xl font-bold text-blue-600 dark:text-blue-400">{confirmed}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Oturdu</p>
          <p className="mt-1 text-2xl font-bold text-purple-600 dark:text-purple-400">{seated}</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Gelmedi</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">{noShow}</p>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
          </div>
        </div>
      ) : reservations.length === 0 ? (
        <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <CalendarCheck className="h-10 w-10 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Bu tarihte rezervasyon yok</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Yeni rezervasyon eklemek için butona tıklayın</p>
          </div>
        </div>
      ) : (
        <div key={viewMode} className="view-transition">
          {viewMode === 'list' && (
            <div className="rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
              <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedReservations.map((r) => (
                  <li key={r.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="flex-shrink-0 w-14 text-center">
                          <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatTime(r.reservation_time)}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-gray-900 dark:text-gray-100">{r.customer_name}</span>
                            <span className={cn('badge', STATUS_COLORS[r.status])}>
                              {STATUS_LABELS[r.status]}
                            </span>
                          </div>
                          <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 flex-wrap">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3.5 w-3.5" />
                              {r.customer_phone}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              {r.party_size} kişi
                            </span>
                            {r.table_number && (
                              <span className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-1.5 py-0.5">
                                Masa {r.table_number}
                              </span>
                            )}
                          </div>
                          {r.notes && (
                            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500 italic">{r.notes}</p>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                        {r.status === 'pending' && (
                          <button
                            onClick={() => updateStatus(r.id, 'confirmed')}
                            className="rounded-md bg-blue-50 dark:bg-blue-900/20 px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                          >
                            Onayla
                          </button>
                        )}
                        {(r.status === 'confirmed' || r.status === 'pending') && (
                          <button
                            onClick={() => updateStatus(r.id, 'seated')}
                            className="rounded-md bg-purple-50 dark:bg-purple-900/20 px-2 py-1 text-xs font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
                          >
                            Oturdu
                          </button>
                        )}
                        {r.status === 'seated' && (
                          <button
                            onClick={() => updateStatus(r.id, 'completed')}
                            className="rounded-md bg-green-50 dark:bg-green-900/20 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                          >
                            Tamamlandı
                          </button>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed') && (
                          <button
                            onClick={() => updateStatus(r.id, 'no_show')}
                            className="rounded-md bg-red-50 dark:bg-red-900/20 px-2 py-1 text-xs font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                          >
                            Gelmedi
                          </button>
                        )}
                        {(r.status === 'pending' || r.status === 'confirmed') && (
                          <button
                            onClick={() => updateStatus(r.id, 'cancelled')}
                            className="rounded-md bg-gray-50 dark:bg-gray-700 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                          >
                            İptal
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(r)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {viewMode === 'box' && (
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
              {sortedReservations.map((r) => (
                <CompactBoxCard
                  key={r.id}
                  initials={r.customer_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                  title={r.customer_name}
                  onClick={() => openEditModal(r)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content w-full max-w-md rounded-2xl bg-white dark:bg-gray-900 shadow-2xl ${isClosingModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingReservation ? 'Rezervasyonu Düzenle' : 'Yeni Rezervasyon'}
              </h2>
              <button
                onClick={() => closeModal()}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    {getCustomerLabelSingular(sector ?? undefined)} Adı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formCustomerName}
                    onChange={e => setFormCustomerName(e.target.value)}
                    placeholder="Ad Soyad"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Telefon <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formCustomerPhone}
                    onChange={e => setFormCustomerPhone(e.target.value)}
                    placeholder="05XX XXX XX XX"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tarih <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Saat <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={formTime}
                    onChange={e => setFormTime(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Kişi Sayısı <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={99}
                    value={formPartySize}
                    onChange={e => setFormPartySize(parseInt(e.target.value) || 1)}
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Masa No
                  </label>
                  <input
                    type="text"
                    value={formTableNumber}
                    onChange={e => setFormTableNumber(e.target.value)}
                    placeholder="Örn: 5, A3"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900"
                  />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Notlar
                  </label>
                  <textarea
                    rows={3}
                    value={formNotes}
                    onChange={e => setFormNotes(e.target.value)}
                    placeholder="Özel istek, alerji vb."
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:border-pulse-900 focus:outline-none focus:ring-1 focus:ring-pulse-900 resize-none"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
              <button
                onClick={() => closeModal()}
                className="rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800 disabled:opacity-60 transition-colors"
              >
                {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {editingReservation ? 'Kaydet' : 'Rezervasyon Ekle'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
