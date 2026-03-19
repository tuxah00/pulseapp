'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, Trash2, Zap, Loader2, X } from 'lucide-react'

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function formatDisplayDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

interface StaffMember { id: string; name: string }
interface Shift {
  id: string
  staff_id: string
  shift_date: string
  start_time: string | null
  end_time: string | null
  shift_type: 'regular' | 'off'
  notes: string | null
}

export default function VardiyePage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const supabase = createClient()

  const [weekOffset, setWeekOffset] = useState(0)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Modal
  const [modal, setModal] = useState<{ staffId: string; date: string } | null>(null)
  const [modalType, setModalType] = useState<'regular' | 'off'>('regular')
  const [modalStart, setModalStart] = useState('09:00')
  const [modalEnd, setModalEnd] = useState('18:00')
  const [modalNotes, setModalNotes] = useState('')

  // Otomatik dağıtım
  const [showAutoPanel, setShowAutoPanel] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoSelectedDays, setAutoSelectedDays] = useState<boolean[]>([true, true, true, true, true, false, false])
  const [autoStartTime, setAutoStartTime] = useState('09:00')
  const [autoEndTime, setAutoEndTime] = useState('18:00')
  const [autoError, setAutoError] = useState<string | null>(null)

  const monday = addDays(getMonday(new Date()), weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const weekStart = formatDate(monday)
  const weekEnd = formatDate(weekDays[6])

  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [{ data: staffData }, shiftsRes] = await Promise.all([
        supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name'),
        fetch(`/api/shifts?businessId=${businessId}&weekStart=${weekStart}&weekEnd=${weekEnd}`),
      ])
      setStaff(staffData || [])
      const { shifts: shiftsData } = await shiftsRes.json()
      setShifts(shiftsData || [])
    } finally {
      setLoading(false)
    }
  }, [businessId, weekStart, weekEnd])

  useEffect(() => {
    if (!ctxLoading && businessId) fetchData()
  }, [fetchData, ctxLoading, businessId])

  function getShift(staffId: string, date: string): Shift | undefined {
    return shifts.find(s => s.staff_id === staffId && s.shift_date === date)
  }

  function openModal(staffId: string, date: string) {
    const existing = getShift(staffId, date)
    setModalType(existing?.shift_type || 'regular')
    setModalStart(existing?.start_time?.slice(0, 5) || '09:00')
    setModalEnd(existing?.end_time?.slice(0, 5) || '18:00')
    setModalNotes(existing?.notes || '')
    setSaveError(null)
    setModal({ staffId, date })
  }

  async function saveShift() {
    if (!modal || !businessId) return
    setSaving(true)
    setSaveError(null)
    try {
      const res = await fetch('/api/shifts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          staffId: modal.staffId,
          shiftDate: modal.date,
          startTime: modalType === 'off' ? null : modalStart,
          endTime: modalType === 'off' ? null : modalEnd,
          shiftType: modalType,
          notes: modalNotes || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setSaveError(json.error || `Sunucu hatası (${res.status})`)
        return
      }
      setModal(null)
      await fetchData()
    } catch (err) {
      setSaveError('Bağlantı hatası. Lütfen tekrar deneyin.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteShift(shiftId: string) {
    try {
      const res = await fetch(`/api/shifts/${shiftId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        alert(json.error || 'Silme işlemi başarısız.')
        return
      }
      await fetchData()
    } catch {
      alert('Bağlantı hatası. Lütfen tekrar deneyin.')
    }
  }

  /** Otomatik haftalık dağıtım: seçili günlere ve mesai saatine göre tüm personele yaz */
  async function handleAutoDist() {
    if (!businessId || staff.length === 0) return
    setAutoSaving(true)
    setAutoError(null)
    try {
      for (const member of staff) {
        for (let di = 0; di < 7; di++) {
          if (!autoSelectedDays[di]) continue
          const dateStr = formatDate(weekDays[di])
          const existing = getShift(member.id, dateStr)
          if (existing) continue
          const res = await fetch('/api/shifts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              businessId,
              staffId: member.id,
              shiftDate: dateStr,
              startTime: autoStartTime,
              endTime: autoEndTime,
              shiftType: 'regular',
              notes: 'Otomatik dağıtım',
            }),
          })
          if (!res.ok) {
            const json = await res.json().catch(() => ({}))
            setAutoError(`${member.name} — ${dateStr}: ${json.error || `Sunucu hatası (${res.status})`}`)
            return
          }
        }
      }
      setShowAutoPanel(false)
      await fetchData()
    } finally {
      setAutoSaving(false)
    }
  }

  if (ctxLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Vardiye Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">Personel vardiyelerini haftalık olarak yönetin</p>
        </div>
        <button
          onClick={() => setShowAutoPanel(p => !p)}
          className="flex items-center gap-2 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-700"
        >
          <Zap className="h-4 w-4" /> Otomatik Dağıt
        </button>
      </div>

      {/* Otomatik Dağıtım Paneli */}
      {showAutoPanel && (
        <div className="card border-pulse-200 bg-pulse-50 dark:bg-pulse-900/20 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Haftalık Otomatik Dağıtım</h3>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Çalışma Günleri</label>
            <div className="flex gap-2 flex-wrap">
              {DAY_LABELS.map((label, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setAutoSelectedDays(prev => prev.map((v, idx) => idx === i ? !v : v))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                    autoSelectedDays[i]
                      ? 'bg-pulse-600 text-white border-pulse-600'
                      : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mesai Saatleri</label>
            <div className="flex items-center gap-3">
              <input
                type="time"
                value={autoStartTime}
                onChange={e => setAutoStartTime(e.target.value)}
                className="input w-32"
              />
              <span className="text-gray-400">—</span>
              <input
                type="time"
                value={autoEndTime}
                onChange={e => setAutoEndTime(e.target.value)}
                className="input w-32"
              />
            </div>
          </div>

          {(() => {
            const selectedCount = autoSelectedDays.filter(Boolean).length
            const [sh, sm] = autoStartTime.split(':').map(Number)
            const [eh, em] = autoEndTime.split(':').map(Number)
            const hours = ((eh * 60 + em) - (sh * 60 + sm)) / 60
            return selectedCount > 0 && hours > 0 ? (
              <p className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2">
                <span className="font-medium text-gray-700 dark:text-gray-200">{selectedCount} gün</span>
                {' × '}
                <span className="font-medium text-gray-700 dark:text-gray-200">{hours.toFixed(1)} saat</span>
                {' = '}
                <span className="font-medium text-pulse-600">{(selectedCount * hours).toFixed(1)} saat/personel</span>
                {' · '}mevcut kayıtlar korunur
              </p>
            ) : null
          })()}

          {autoError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {autoError}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={() => { setShowAutoPanel(false); setAutoError(null) }}
              className="btn-secondary flex-1"
            >
              İptal
            </button>
            <button
              onClick={handleAutoDist}
              disabled={autoSaving || autoSelectedDays.every(d => !d)}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-700 disabled:opacity-50"
            >
              {autoSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Dağıt ({staff.length} personel)
            </button>
          </div>
        </div>
      )}

      {/* Hafta Navigasyonu */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="p-2 rounded-lg border border-gray-200 hover:border-gray-300 dark:border-gray-600"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="font-medium text-gray-900 dark:text-gray-100">
          {formatDisplayDate(monday)} — {formatDisplayDate(weekDays[6])}
        </span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="p-2 rounded-lg border border-gray-200 hover:border-gray-300 dark:border-gray-600"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        {weekOffset !== 0 && (
          <button onClick={() => setWeekOffset(0)} className="text-xs text-blue-600 hover:underline">
            Bu Hafta
          </button>
        )}
      </div>

      {/* Izgarası */}
      {staff.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-sm">Henüz personel eklenmemiş. Önce personel ekleyin.</p>
        </div>
      ) : (
        <div className="card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-3 pr-4 text-left font-medium text-gray-500 dark:text-gray-400 w-32">Personel</th>
                {weekDays.map((day, i) => (
                  <th key={i} className="py-3 px-2 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[100px]">
                    <div>{DAY_LABELS[i]}</div>
                    <div className="text-xs text-gray-400">{formatDisplayDate(day)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {staff.map(member => (
                <tr key={member.id}>
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {member.name}
                  </td>
                  {weekDays.map((day, di) => {
                    const dateStr = formatDate(day)
                    const shift = getShift(member.id, dateStr)
                    return (
                      <td key={di} className="py-2 px-2 text-center">
                        {shift ? (
                          <div className={cn(
                            'relative group rounded-lg px-2 py-1.5 text-xs cursor-pointer',
                            shift.shift_type === 'off'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          )}>
                            <button
                              onClick={() => openModal(member.id, dateStr)}
                              className="w-full text-center"
                            >
                              {shift.shift_type === 'off' ? (
                                'İzin'
                              ) : (
                                <>
                                  <div className="font-medium">{shift.start_time?.slice(0, 5)}</div>
                                  <div className="opacity-70">{shift.end_time?.slice(0, 5)}</div>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => deleteShift(shift.id)}
                              className="absolute -top-1.5 -right-1.5 hidden group-hover:flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-white"
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => openModal(member.id, dateStr)}
                            className="h-10 w-full rounded-lg border-2 border-dashed border-gray-200 dark:border-gray-600 text-gray-300 hover:border-blue-300 hover:text-blue-400 transition-colors flex items-center justify-center"
                          >
                            <Plus className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {staff.find(s => s.id === modal.staffId)?.name} — {modal.date}
              </h3>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tip seçimi */}
            <div className="flex gap-2">
              <button
                onClick={() => setModalType('regular')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  modalType === 'regular'
                    ? 'bg-green-600 text-white border-green-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                Çalışma
              </button>
              <button
                onClick={() => setModalType('off')}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  modalType === 'off'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                İzin Günü
              </button>
            </div>

            {modalType === 'regular' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Başlangıç</label>
                  <input type="time" value={modalStart} onChange={e => setModalStart(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label">Bitiş</label>
                  <input type="time" value={modalEnd} onChange={e => setModalEnd(e.target.value)} className="input" />
                </div>
              </div>
            )}

            <div>
              <label className="label">Not (opsiyonel)</label>
              <input
                type="text"
                value={modalNotes}
                onChange={e => setModalNotes(e.target.value)}
                placeholder="İzin sebebi vb."
                className="input"
              />
            </div>

            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">İptal</button>
              <button
                onClick={saveShift}
                disabled={saving}
                className="flex-1 rounded-lg bg-pulse-600 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
