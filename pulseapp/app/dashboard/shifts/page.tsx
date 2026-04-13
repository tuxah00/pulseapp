'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { createClient } from '@/lib/supabase/client'
import { logAudit } from '@/lib/utils/audit'
import type { WorkingHours, ShiftDefinition } from '@/types'
import { cn } from '@/lib/utils'
import { ChevronLeft, ChevronRight, Plus, Trash2, Zap, Loader2, X, Save, Clock, CalendarDays, Download, Share2, RotateCcw, ImageIcon } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { Portal } from '@/components/ui/portal'

const DAY_LABELS = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const DAY_LABELS_FULL: Record<string, string> = {
  mon: 'Pazartesi', tue: 'Salı', wed: 'Çarşamba',
  thu: 'Perşembe', fri: 'Cuma', sat: 'Cumartesi', sun: 'Pazar',
}

const DEFAULT_WORKING_HOURS: WorkingHours = {
  mon: { open: '09:00', close: '18:00' },
  tue: { open: '09:00', close: '18:00' },
  wed: { open: '09:00', close: '18:00' },
  thu: { open: '09:00', close: '18:00' },
  fri: { open: '09:00', close: '18:00' },
  sat: { open: '10:00', close: '16:00' },
  sun: null,
}

function generateTimeOptions(): string[] {
  const times: string[] = []
  for (let h = 0; h < 24; h++) {
    times.push(`${String(h).padStart(2, '0')}:00`)
    times.push(`${String(h).padStart(2, '0')}:30`)
  }
  return times
}
const TIME_OPTIONS = generateTimeOptions()

function getMonday(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  d.setDate(diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
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
  shift_type: 'regular' | 'off' | 'part_time'
  notes: string | null
}

export default function VardiyePage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, loading: ctxLoading, permissions } = useBusinessContext()
  const supabase = createClient()

  const [weekOffset, setWeekOffset] = useState(0)
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Modal
  const [modal, setModal] = useState<{ staffId: string; date: string } | null>(null)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [modalType, setModalType] = useState<'regular' | 'off' | 'part_time'>('regular')
  const [modalStart, setModalStart] = useState('09:00')
  const [modalEnd, setModalEnd] = useState('18:00')
  const [modalNotes, setModalNotes] = useState('')

  // Working hours (closed days)
  const [workingHours, setWorkingHours] = useState<WorkingHours | null>(null)

  // Tab
  const [activeTab, setActiveTab] = useState<'shifts' | 'hours'>('shifts')

  // Mesai tanımları (shift definitions)
  const [shiftDefs, setShiftDefs] = useState<ShiftDefinition[]>([])
  const [shiftDefsSaving, setShiftDefsSaving] = useState(false)

  // Reset table
  const [resetConfirm, setResetConfirm] = useState(false)
  const [isClosingResetConfirm, setIsClosingResetConfirm] = useState(false)
  const closeResetConfirm = () => setIsClosingResetConfirm(true)
  const [resetting, setResetting] = useState(false)

  // Table ref for image capture
  const tableRef = useRef<HTMLDivElement>(null)

  // Otomatik dağıtım
  const [showAutoPanel, setShowAutoPanel] = useState(false)
  const [autoSaving, setAutoSaving] = useState(false)
  const [autoSelectedDays, setAutoSelectedDays] = useState<boolean[]>([true, true, true, true, true, false, false])
  const [autoError, setAutoError] = useState<string | null>(null)

  const monday = addDays(getMonday(new Date()), weekOffset * 7)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const weekStart = formatDate(monday)
  const weekEnd = formatDate(weekDays[6])

  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const [{ data: staffData }, shiftsRes, { data: bizData }] = await Promise.all([
        supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name'),
        fetch(`/api/shifts?businessId=${businessId}&weekStart=${weekStart}&weekEnd=${weekEnd}`),
        supabase.from('businesses').select('working_hours, settings').eq('id', businessId).single(),
      ])
      setStaff(staffData || [])
      setWorkingHours(bizData?.working_hours || null)
      // Load shift definitions from business settings
      const settings = bizData?.settings as Record<string, unknown> | null
      if (settings?.shift_definitions && Array.isArray(settings.shift_definitions)) {
        setShiftDefs(settings.shift_definitions as ShiftDefinition[])
      }
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

  const isDayOpen = (dayIndex: number): boolean => {
    if (!workingHours) return true
    const key = DAY_KEYS[dayIndex] as keyof WorkingHours
    return workingHours[key] !== null
  }

  function openModal(staffId: string, date: string) {
    const [year, month, day] = date.split('-').map(Number)
    const dateObj = new Date(year, month - 1, day)
    const jsDay = dateObj.getDay()
    const dayIndex = jsDay === 0 ? 6 : jsDay - 1
    if (!isDayOpen(dayIndex)) return

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
          shiftType: modalType === 'part_time' ? 'regular' : modalType,
          notes: modalType === 'part_time' ? (modalNotes ? `Yarı zamanlı · ${modalNotes}` : 'Yarı zamanlı') : (modalNotes || null),
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        setSaveError(json.error || `Sunucu hatası (${res.status})`)
        return
      }
      closeModal()
      await fetchData()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Vardiya kaydedildi' } }))
      logAudit({ businessId: businessId!, staffId: currentStaffId, staffName: currentStaffName, action: 'create', resource: 'shift', details: { staff_id: modal.staffId, date: modal.date, type: modalType } })
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
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Silme işlemi başarısız.' } }))
        return
      }
      await fetchData()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Vardiya silindi' } }))
      logAudit({ businessId: businessId!, staffId: currentStaffId, staffName: currentStaffName, action: 'delete', resource: 'shift', resourceId: shiftId, details: {} })
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Bağlantı hatası. Lütfen tekrar deneyin.' } }))
    }
  }

  /** Mesai tanımlarını business settings'e kaydet */
  async function saveShiftDefinitions() {
    if (!businessId) return
    setShiftDefsSaving(true)
    try {
      // Mevcut settings'i al
      const { data: biz } = await supabase.from('businesses').select('settings').eq('id', businessId).single()
      const currentSettings = (biz?.settings as Record<string, unknown>) || {}
      const updatedSettings = { ...currentSettings, shift_definitions: shiftDefs }
      const { error } = await supabase.from('businesses').update({ settings: updatedSettings }).eq('id', businessId)
      if (error) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Kaydetme hatası: ' + error.message } }))
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Mesai tanımları kaydedildi' } }))
      }
    } finally {
      setShiftDefsSaving(false)
    }
  }

  /** Otomatik haftalık dağıtım: Round-robin — mesai tanımlarına göre personellere sırayla ata */
  async function handleAutoDist() {
    if (!businessId || staff.length === 0 || shiftDefs.length === 0) return
    setAutoSaving(true)
    setAutoError(null)
    try {
      const tasks: { member: StaffMember; dateStr: string; promise: Promise<Response> }[] = []

      for (let di = 0; di < 7; di++) {
        if (!autoSelectedDays[di]) continue
        const dateStr = formatDate(weekDays[di])

        // Round-robin: her gün için personellere sırayla mesai tanımı ata
        let defIndex = 0
        for (const member of staff) {
          if (getShift(member.id, dateStr)) continue
          const def = shiftDefs[defIndex % shiftDefs.length]
          const durationMinutes = toMinutes(def.end) - toMinutes(def.start)
          const isPartTime = durationMinutes > 0 && durationMinutes < 360 // Less than 6 hours
          const shiftNotes = isPartTime ? `Yarı zamanlı · ${def.name}` : def.name
          tasks.push({
            member,
            dateStr,
            promise: fetch('/api/shifts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                businessId,
                staffId: member.id,
                shiftDate: dateStr,
                startTime: def.start,
                endTime: def.end,
                shiftType: 'regular',
                notes: shiftNotes,
              }),
            }),
          })
          defIndex++
        }
      }

      const results = await Promise.allSettled(tasks.map(t => t.promise))
      const errors: string[] = []
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        if (result.status === 'rejected') {
          errors.push(`${tasks[i].member.name} — ${tasks[i].dateStr}: Bağlantı hatası`)
        } else if (!result.value.ok) {
          const json = await result.value.json().catch(() => ({}))
          errors.push(`${tasks[i].member.name} — ${tasks[i].dateStr}: ${json.error || result.value.status}`)
        }
      }
      if (errors.length > 0) {
        setAutoError(errors.join(' | '))
      } else {
        setShowAutoPanel(false)
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Otomatik dağıtım tamamlandı' } }))
      }
    } finally {
      setAutoSaving(false)
      await fetchData()
    }
  }

  function toggleDay(day: keyof WorkingHours) {
    setWorkingHours(prev => {
      if (!prev) return prev
      return { ...prev, [day]: prev[day] ? null : { open: '09:00', close: '18:00' } }
    })
  }

  function updateDayHours(day: keyof WorkingHours, field: 'open' | 'close', value: string) {
    setWorkingHours(prev => {
      if (!prev) return prev
      return { ...prev, [day]: { ...(prev[day] || { open: '09:00', close: '18:00' }), [field]: value } }
    })
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault()
    if (!businessId) return
    setSaving(true)
    setSaveError(null)
    try {
      const { error } = await supabase.from('businesses').update({ working_hours: workingHours }).eq('id', businessId)
      if (error) {
        setSaveError('Kaydetme hatası: ' + error.message)
      } else {
        setSaveError(null)
        await fetchData()
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Çalışma saatleri kaydedildi' } }))
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleResetTable() {
    setResetting(true)
    try {
      const weekShifts = shifts.filter(s => {
        const d = new Date(s.shift_date + 'T00:00:00')
        return d >= monday && d < addDays(monday, 7)
      })
      await Promise.allSettled(
        weekShifts.map(s => fetch(`/api/shifts/${s.id}`, { method: 'DELETE' }))
      )
      await fetchData()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Tablo sıfırlandı' } }))
    } finally {
      setResetting(false)
      closeResetConfirm()
    }
  }

  async function handleSaveImage() {
    if (!tableRef.current) return
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(tableRef.current, {
        backgroundColor: document.documentElement.classList.contains('dark') ? '#1f2937' : '#ffffff',
        scale: 2,
      })
      const link = document.createElement('a')
      link.download = `vardiya-${weekStart}-${formatDate(addDays(monday, 6))}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (err) {
      console.error('Image save error:', err)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Görsel oluşturulurken hata oluştu.' } }))
    }
  }

  async function handleWhatsAppShare() {
    // İlk olarak resmi indir
    await handleSaveImage()
    // Sonra WhatsApp'ı aç
    const weekEndDate = formatDate(addDays(monday, 6))
    const text = encodeURIComponent(`Haftalık Vardiya Tablosu (${weekStart} — ${weekEndDate})`)
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  if (permissions && !permissions.shifts) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Vardiya Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">Personel vardiyelerini ve çalışma saatlerini yönetin</p>
        </div>
        {activeTab === 'shifts' && (
          <button
            onClick={() => setShowAutoPanel(p => !p)}
            className="flex items-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800"
          >
            <Zap className="h-4 w-4" /> Otomatik Dağıt
          </button>
        )}
      </div>

      {/* Tab Navigasyonu */}
      <div className="flex gap-1 rounded-xl bg-gray-100 dark:bg-gray-800 p-1">
        <button
          onClick={() => setActiveTab('shifts')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'shifts'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <CalendarDays className="h-4 w-4" />
          Vardiya Yönetimi
        </button>
        <button
          onClick={() => setActiveTab('hours')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
            activeTab === 'hours'
              ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Clock className="h-4 w-4" />
          Çalışma Saatleri
        </button>
      </div>

      {activeTab === 'shifts' && (<>
      {/* Otomatik Dağıtım Paneli */}
      {showAutoPanel && (
        <div className="card border-pulse-200 bg-pulse-50 dark:bg-pulse-900/20 space-y-4">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">Haftalık Otomatik Dağıtım</h3>

          {/* Mesai Tanımları */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Mesai Tanımları</label>
            <p className="text-xs text-gray-500">Sabahçı, öğlenci gibi mesai tanımları oluşturun. Otomatik dağıtımda personellere sırayla atanır.</p>

            {shiftDefs.length > 0 && (
              <div className="space-y-2">
                {shiftDefs.map((def, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-2.5">
                    <input
                      type="text"
                      value={def.name}
                      onChange={e => {
                        const updated = [...shiftDefs]
                        updated[idx] = { ...updated[idx], name: e.target.value }
                        setShiftDefs(updated)
                      }}
                      placeholder="Mesai adı (ör: Sabahçı)"
                      className="input flex-1"
                    />
                    <input
                      type="time"
                      value={def.start}
                      onChange={e => {
                        const updated = [...shiftDefs]
                        updated[idx] = { ...updated[idx], start: e.target.value }
                        setShiftDefs(updated)
                      }}
                      className="input w-28"
                    />
                    <span className="text-gray-400">—</span>
                    <input
                      type="time"
                      value={def.end}
                      onChange={e => {
                        const updated = [...shiftDefs]
                        updated[idx] = { ...updated[idx], end: e.target.value }
                        setShiftDefs(updated)
                      }}
                      className="input w-28"
                    />
                    <button
                      onClick={() => setShiftDefs(prev => prev.filter((_, i) => i !== idx))}
                      className="rounded-lg p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShiftDefs(prev => [...prev, { name: '', start: '08:00', end: '14:00' }])}
                className="flex items-center gap-1.5 text-sm font-medium text-pulse-900 dark:text-pulse-400 hover:text-pulse-900 dark:hover:text-pulse-300 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Mesai Tanımı Ekle
              </button>
              {shiftDefs.length > 0 && (
                <button
                  onClick={saveShiftDefinitions}
                  disabled={shiftDefsSaving}
                  className="flex items-center gap-1.5 text-sm font-medium text-green-600 dark:text-green-400 hover:text-green-700 transition-colors ml-auto"
                >
                  {shiftDefsSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Tanımları Kaydet
                </button>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Çalışma Günleri</label>
            <div className="flex gap-2 flex-wrap">
              {DAY_LABELS.map((label, i) => {
                const closed = !isDayOpen(i)
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={closed}
                    onClick={() => setAutoSelectedDays(prev => prev.map((v, idx) => idx === i ? !v : v))}
                    className={cn(
                      'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
                      closed
                        ? 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600 border-gray-200 dark:border-gray-700 cursor-not-allowed'
                        : autoSelectedDays[i]
                          ? 'bg-pulse-800 text-white border-pulse-900'
                          : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
                    )}
                  >
                    {label}{closed ? ' (Kapalı)' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Dağıtım özeti */}
          {shiftDefs.length > 0 && (() => {
            const selectedCount = autoSelectedDays.filter(Boolean).length
            return selectedCount > 0 ? (
              <div className="text-sm text-gray-500 bg-gray-50 dark:bg-gray-800/50 rounded-lg px-3 py-2 space-y-1">
                <p>
                  <span className="font-medium text-gray-700 dark:text-gray-200">{selectedCount} gün</span>
                  {' × '}
                  <span className="font-medium text-gray-700 dark:text-gray-200">{staff.length} personel</span>
                  {' · Round-robin dağıtım · mevcut kayıtlar korunur'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {shiftDefs.map((def, i) => (
                    <span key={i} className="inline-flex items-center gap-1 bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-300 px-2 py-0.5 rounded-full text-xs font-medium">
                      {def.name || `Tanım ${i + 1}`}: {def.start}–{def.end}
                    </span>
                  ))}
                </div>
              </div>
            ) : null
          })()}

          {shiftDefs.length === 0 && (
            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              Otomatik dağıtım için en az bir mesai tanımı oluşturun.
            </div>
          )}

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
              disabled={autoSaving || autoSelectedDays.every(d => !d) || shiftDefs.length === 0}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800 disabled:opacity-50"
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
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={() => setResetConfirm(true)}
            className="p-2 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
            title="Tabloyu Sıfırla"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleSaveImage}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title="Resim Olarak Kaydet"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={handleWhatsAppShare}
            className="p-2 rounded-lg text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
            title="WhatsApp ile Paylaş"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Izgarası */}
      {staff.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <p className="text-sm">Henüz personel eklenmemiş. Önce personel ekleyin.</p>
        </div>
      ) : (
        <div ref={tableRef} className="card overflow-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="py-3 pr-4 text-left font-medium text-gray-500 dark:text-gray-400 w-32">Personel</th>
                {weekDays.map((day, i) => {
                  if (!isDayOpen(i)) return null
                  return (
                    <th key={i} className="py-3 px-2 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[100px]">
                      <div>{DAY_LABELS[i]}</div>
                      <div className="text-xs text-gray-400">{formatDisplayDate(day)}</div>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {staff.map(member => (
                <tr key={member.id}>
                  <td className="py-3 pr-4 font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {member.name}
                  </td>
                  {weekDays.map((day, di) => {
                    if (!isDayOpen(di)) return null
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
                                  {shift.notes && !shift.notes.startsWith('Otomatik') && (
                                    <div className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-[80px]">
                                      {shift.notes.replace('Yarı zamanlı · ', '')}
                                    </div>
                                  )}
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

      {/* Reset Confirmation Modal */}
      {(resetConfirm || isClosingResetConfirm) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 ${isClosingResetConfirm ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingResetConfirm) { setResetConfirm(false); setIsClosingResetConfirm(false) } }}>
          <div className={`modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 ${isClosingResetConfirm ? 'closing' : ''}`}>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100">Tabloyu Sıfırla</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Bu haftanın tüm vardiyalarını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.
            </p>
            <div className="flex gap-2">
              <button onClick={() => closeResetConfirm()} disabled={resetting} className="btn-secondary flex-1 text-sm">İptal</button>
              <button onClick={handleResetTable} disabled={resetting} className="flex-1 text-sm px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50">
                {resetting ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Evet, Sıfırla'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Modal */}
      {(modal || isClosingModal) && (() => {
        if (!modal) return null
        return (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setModal(null); setIsClosingModal(false) } }}>
          <div className={`modal-content bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4 ${isClosingModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">
                {staff.find(s => s.id === modal.staffId)?.name} — {modal.date}
              </h3>
              <button onClick={() => closeModal()} className="text-gray-400 hover:text-gray-600">
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
                Tam Mesai
              </button>
              <button
                onClick={() => { setModalType('part_time'); setModalStart('09:00'); setModalEnd('13:00') }}
                className={cn(
                  'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                  modalType === 'part_time'
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                Yarı Zamanlı
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
                İzin
              </button>
            </div>

            {/* Mesai tanımı hızlı seçim */}
            {(modalType === 'regular' || modalType === 'part_time') && shiftDefs.length > 0 && (
              <div className="space-y-1">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Hızlı Seçim</label>
                <div className="flex gap-2 flex-wrap">
                  {shiftDefs.map((def, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { setModalStart(def.start); setModalEnd(def.end); setModalNotes(def.name) }}
                      className={cn(
                        'py-1.5 px-3 rounded-lg text-xs font-medium border transition-colors',
                        modalStart === def.start && modalEnd === def.end
                          ? 'bg-pulse-50 border-pulse-300 text-pulse-900 dark:bg-pulse-900/30 dark:border-pulse-900 dark:text-pulse-300'
                          : 'border-gray-200 dark:border-gray-600 text-gray-500 hover:border-gray-300'
                      )}
                    >
                      {def.name || `Tanım ${i + 1}`} ({def.start}–{def.end})
                    </button>
                  ))}
                </div>
              </div>
            )}

            {(modalType === 'regular' || modalType === 'part_time') && (
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
                placeholder="İzin sebebi, mesai adı vb."
                className="input"
              />
            </div>

            {saveError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {saveError}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => closeModal()} className="btn-secondary flex-1">İptal</button>
              <button
                onClick={saveShift}
                disabled={saving}
                className="flex-1 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800 disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
        )
      })()}
      </>)}

      {activeTab === 'hours' && (
        <form onSubmit={handleSaveHours}>
          <div className="card">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Çalışma Saatleri</h2>
            <p className="text-sm text-gray-500 mb-6">
              İşletmenizin açık olduğu gün ve saatleri belirleyin. Kapalı günlerde vardiya atanamaz.
            </p>

            <div className="space-y-3">
              {DAY_KEYS.map((day) => {
                const hours = workingHours?.[day as keyof WorkingHours]
                const isOpen = hours !== null && hours !== undefined

                return (
                  <div
                    key={day}
                    className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                      isOpen
                        ? 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800'
                        : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
                    }`}
                  >
                    <div className="w-28 flex-shrink-0">
                      <span className={`text-sm font-medium ${isOpen ? 'text-gray-900 dark:text-gray-100' : 'text-gray-400'}`}>
                        {DAY_LABELS_FULL[day]}
                      </span>
                    </div>

                    <label className="relative inline-flex cursor-pointer items-center flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={() => toggleDay(day as keyof WorkingHours)}
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-pulse-900 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:ring-2 peer-focus:ring-pulse-300" />
                    </label>

                    {isOpen ? (
                      <div className="flex flex-1 items-center gap-2">
                        <CustomSelect
                          value={hours?.open || '09:00'}
                          onChange={v => updateDayHours(day as keyof WorkingHours, 'open', v)}
                          options={TIME_OPTIONS.map(t => ({ value: t, label: t }))}
                        />
                        <span className="text-sm text-gray-400">—</span>
                        <CustomSelect
                          value={hours?.close || '18:00'}
                          onChange={v => updateDayHours(day as keyof WorkingHours, 'close', v)}
                          options={TIME_OPTIONS.map(t => ({ value: t, label: t }))}
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">Kapalı</span>
                    )}
                  </div>
                )
              })}
            </div>

            {saveError && (
              <div className="mt-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
                {saveError}
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={saving} className="flex items-center gap-2 rounded-lg bg-pulse-800 px-4 py-2 text-sm font-medium text-white hover:bg-pulse-800 disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Saatleri Kaydet
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
