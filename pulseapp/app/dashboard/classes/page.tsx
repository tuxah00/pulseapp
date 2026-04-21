'use client'

import { useState, useEffect, useCallback } from 'react'
import { Portal } from '@/components/ui/portal'
import { useRouter } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import {
  CalendarDays,
  Plus,
  Clock,
  Users,
  ChevronLeft,
  ChevronRight,
  Settings,
  Eye,
  Trash2,
} from 'lucide-react'

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

const COLOR_OPTIONS = [
  { value: '#6366f1', label: 'İndigo' },
  { value: '#ec4899', label: 'Pembe' },
  { value: '#f59e0b', label: 'Turuncu' },
  { value: '#10b981', label: 'Yeşil' },
  { value: '#3b82f6', label: 'Mavi' },
  { value: '#8b5cf6', label: 'Mor' },
]

interface ClassItem {
  id: string
  business_id: string
  name: string
  instructor_id: string | null
  day_of_week: number[]
  start_time: string
  duration_minutes: number
  capacity: number
  color: string
  is_active: boolean
  created_at: string
}

function getWeekDates(weekOffset: number): Date[] {
  const today = new Date()
  const dayOfWeek = today.getDay()
  // Convert Sunday=0 to Monday=0 based index
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const monday = new Date(today)
  monday.setDate(today.getDate() + mondayOffset + weekOffset * 7)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })
}

function formatDateISO(date: Date): string {
  // Yerel tarih — toISOString UTC'ye çevirdiği için UTC+3'te önceki güne kayıyor
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export default function ClassesPage() {
  const { businessId, sector, permissions } = useBusinessContext()
  const { confirm } = useConfirm()
  const router = useRouter()
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [weekDates, setWeekDates] = useState<Date[]>([])
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingClass, setEditingClass] = useState<ClassItem | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    color: '#6366f1',
    day_of_week: [] as number[],
    start_time: '09:00',
    duration_minutes: 60,
    capacity: 20,
  })

  useEffect(() => {
    setWeekDates(getWeekDates(weekOffset))
  }, [weekOffset])

  const fetchClasses = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/classes?businessId=${businessId}`)
      const data = await res.json()
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error || 'Sınıflar yüklenemedi' } }))
        return
      }
      setClasses(data.classes || [])
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  function openNewModal() {
    setEditingClass(null)
    setForm({
      name: '',
      color: '#6366f1',
      day_of_week: [],
      start_time: '09:00',
      duration_minutes: 60,
      capacity: 20,
    })
    setShowModal(true)
  }

  function openEditModal(cls: ClassItem) {
    setEditingClass(cls)
    setForm({
      name: cls.name,
      color: cls.color,
      day_of_week: cls.day_of_week,
      start_time: cls.start_time.slice(0, 5),
      duration_minutes: cls.duration_minutes,
      capacity: cls.capacity,
    })
    setShowModal(true)
  }

  function toggleDay(day: number) {
    setForm(prev => ({
      ...prev,
      day_of_week: prev.day_of_week.includes(day)
        ? prev.day_of_week.filter(d => d !== day)
        : [...prev.day_of_week, day].sort(),
    }))
  }

  async function handleSave() {
    if (!businessId || !form.name.trim() || form.day_of_week.length === 0) return
    setSaving(true)
    try {
      const res = editingClass
        ? await fetch(`/api/classes?id=${editingClass.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(form),
          })
        : await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...form, business_id: businessId }),
          })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error || 'Kaydedilemedi' } }))
        return
      }
      closeModal()
      fetchClasses()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu sınıfı silmek istediğinizden emin misiniz?' })
    if (!ok) return
    const res = await fetch(`/api/classes?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error || 'Silinemedi' } }))
      return
    }
    fetchClasses()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
  }

  async function handleToggleActive(cls: ClassItem) {
    const res = await fetch(`/api/classes?id=${cls.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !cls.is_active }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: data.error || 'Durum güncellenemedi' } }))
      return
    }
    fetchClasses()
  }

  function handleClassClick(cls: ClassItem, date: Date) {
    const dateStr = formatDateISO(date)
    router.push(`/dashboard/classes/attendance?classId=${cls.id}&date=${dateStr}&className=${encodeURIComponent(cls.name)}`)
  }

  const todayISO = formatDateISO(new Date())

  requireSectorModule(sector, 'classes')
  requirePermission(permissions, 'classes')

  return (
    <div className="p-6 max-w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="h-7 w-7 text-indigo-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Sınıf Programı</h1>
            <p className="text-sm text-gray-500">Haftalık grup dersleri</p>
          </div>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Yeni Sınıf
        </button>
      </div>

      {/* Week navigation */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setWeekOffset(o => o - 1)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          Önceki Hafta
        </button>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {weekDates.length > 0
            ? `${formatDate(weekDates[0])} - ${formatDate(weekDates[6])}`
            : ''}
          {weekOffset === 0 && (
            <span className="ml-2 text-xs text-indigo-600 dark:text-indigo-400 font-semibold">Bu Hafta</span>
          )}
        </span>
        <button
          onClick={() => setWeekOffset(o => o + 1)}
          className="flex items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm"
        >
          Sonraki Hafta
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Weekly grid */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Yükleniyor...</div>
      ) : (
        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, dayIndex) => {
            const dateISO = formatDateISO(date)
            const isToday = dateISO === todayISO
            const dayClasses = classes.filter(cls => cls.day_of_week.includes(dayIndex))
            return (
              <div key={dayIndex} className={`min-h-[200px] rounded-xl border ${isToday ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 dark:border-indigo-700' : 'border-gray-200 bg-white dark:bg-gray-900 dark:border-gray-700'}`}>
                {/* Day header */}
                <div className={`px-3 py-2 border-b ${isToday ? 'border-indigo-300 dark:border-indigo-700' : 'border-gray-100 dark:border-gray-700'}`}>
                  <p className={`text-xs font-semibold ${isToday ? 'text-indigo-700' : 'text-gray-500'}`}>
                    {DAY_NAMES[dayIndex]}
                  </p>
                  <p className={`text-lg font-bold leading-tight ${isToday ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {date.getDate()}
                  </p>
                </div>

                {/* Classes for this day */}
                <div className="p-1.5 space-y-1.5">
                  {dayClasses.length === 0 && (
                    <p className="text-xs text-gray-300 text-center py-4">—</p>
                  )}
                  {dayClasses.map(cls => (
                    <div
                      key={cls.id}
                      onClick={() => handleClassClick(cls, date)}
                      className="rounded-lg p-2 cursor-pointer hover:opacity-90 transition-opacity group relative"
                      style={{ borderLeft: `4px solid ${cls.color}`, backgroundColor: `${cls.color}15` }}
                    >
                      <p className="text-xs font-semibold text-gray-800 truncate">{cls.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-500">{cls.start_time.slice(0, 5)}</span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Users className="h-3 w-3 text-gray-500" />
                        <span className="text-xs text-gray-500">{cls.capacity} kişi</span>
                      </div>
                      {/* Actions on hover */}
                      <div className="absolute top-1 right-1 hidden group-hover:flex gap-0.5">
                        <button
                          onClick={e => { e.stopPropagation(); openEditModal(cls) }}
                          className="p-0.5 rounded bg-white dark:bg-gray-700 shadow-sm hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Settings className="h-3 w-3 text-gray-600 dark:text-gray-300" />
                        </button>
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(cls.id) }}
                          className="p-0.5 rounded bg-white dark:bg-gray-700 shadow-sm hover:bg-red-50 dark:hover:bg-red-900/30"
                        >
                          <Trash2 className="h-3 w-3 text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* All classes list */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Tüm Sınıflar</h2>
        {classes.length === 0 ? (
          <p className="text-gray-400 text-sm">Henüz sınıf eklenmemiş.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {classes.map(cls => (
              <div key={cls.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-3 h-3 rounded-full mt-1 flex-shrink-0" style={{ backgroundColor: cls.color }} />
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{cls.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {cls.day_of_week.map(d => DAY_NAMES[d].slice(0, 3)).join(', ')} · {cls.start_time.slice(0, 5)} · {cls.duration_minutes}dk
                    </p>
                    <p className="text-xs text-gray-400">{cls.capacity} kişi kapasiteli</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <button
                    onClick={() => handleToggleActive(cls)}
                    className={cls.is_active ? 'badge-success' : 'badge-neutral'}
                  >
                    {cls.is_active ? 'Aktif' : 'Pasif'}
                  </button>
                  <div className="flex gap-1 mt-1">
                    <button onClick={() => openEditModal(cls)} className="p-1 rounded hover:bg-gray-100">
                      <Settings className="h-3.5 w-3.5 text-gray-500" />
                    </button>
                    <button onClick={() => router.push(`/dashboard/classes/attendance?classId=${cls.id}&date=${todayISO}&className=${encodeURIComponent(cls.name)}`)} className="p-1 rounded hover:bg-gray-100">
                      <Eye className="h-3.5 w-3.5 text-indigo-500" />
                    </button>
                    <button onClick={() => handleDelete(cls.id)} className="p-1 rounded hover:bg-red-50">
                      <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <Portal>
        <div className={`fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4 modal-overlay ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md p-6 modal-content ${isClosingModal ? 'closing' : ''}`}>
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              {editingClass ? 'Sınıfı Düzenle' : 'Yeni Sınıf Ekle'}
            </h2>

            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sınıf Adı</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: Sabah Yogası"
                />
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Renk</label>
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map(c => (
                    <button
                      key={c.value}
                      onClick={() => setForm(p => ({ ...p, color: c.value }))}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c.value ? 'border-gray-900 scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c.value }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>

              {/* Days */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Günler</label>
                <div className="flex flex-wrap gap-2">
                  {DAY_NAMES.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => toggleDay(i)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        form.day_of_week.includes(i)
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-indigo-300'
                      }`}
                    >
                      {name.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Time & Duration */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Başlangıç Saati</label>
                  <input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Süre (dk)</label>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={form.duration_minutes}
                    onChange={e => setForm(p => ({ ...p, duration_minutes: parseInt(e.target.value) || 60 }))}
                    className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Capacity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kapasite</label>
                <input
                  type="number"
                  min={1}
                  value={form.capacity}
                  onChange={e => setForm(p => ({ ...p, capacity: parseInt(e.target.value) || 20 }))}
                  className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => closeModal()}
                className="flex-1 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || form.day_of_week.length === 0}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
