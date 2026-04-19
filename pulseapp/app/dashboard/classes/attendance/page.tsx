'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requireSectorModule } from '@/lib/hooks/use-require-permission'
import { Users, Plus, Trash2, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { formatDateISO } from '@/lib/utils'

interface ClassItem {
  id: string
  name: string
  start_time: string
  duration_minutes: number
  capacity: number
  color: string
  day_of_week: number[]
}

interface Session {
  id: string
  class_id: string
  session_date: string
}

interface AttendanceRecord {
  id: string
  session_id: string
  customer_id: string | null
  customer_name: string
  status: 'present' | 'absent' | 'late'
  created_at: string
}

const DAY_NAMES = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar']

function getJsDayIndex(date: Date): number {
  // JS: 0=Sun, 1=Mon ... we want 0=Mon
  const js = date.getDay()
  return js === 0 ? 6 : js - 1
}

function AttendancePage() {
  const { businessId, sector } = useBusinessContext()
  requireSectorModule(sector, 'classes')
  const searchParams = useSearchParams()

  const [selectedDate, setSelectedDate] = useState(() => {
    return searchParams.get('date') || formatDateISO(new Date())
  })
  const [classes, setClasses] = useState<ClassItem[]>([])
  const [selectedClassId, setSelectedClassId] = useState<string>(searchParams.get('classId') || '')
  const [session, setSession] = useState<Session | null>(null)
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([])
  const [loadingClasses, setLoadingClasses] = useState(true)
  const [loadingAttendance, setLoadingAttendance] = useState(false)
  const [newName, setNewName] = useState('')
  const [addingPerson, setAddingPerson] = useState(false)

  // Fetch classes for the business
  const fetchClasses = useCallback(async () => {
    if (!businessId) return
    setLoadingClasses(true)
    try {
      const res = await fetch(`/api/classes?businessId=${businessId}`)
      const data = await res.json()
      setClasses(data.classes || [])
    } catch {
      // ignore
    } finally {
      setLoadingClasses(false)
    }
  }, [businessId])

  useEffect(() => {
    fetchClasses()
  }, [fetchClasses])

  // Filter classes for selected date
  const dateObj = new Date(selectedDate + 'T12:00:00')
  const dayIndex = getJsDayIndex(dateObj)
  const classesForDay = classes.filter(cls => cls.day_of_week.includes(dayIndex))

  // Fetch or create session + attendance when class+date selected
  const fetchSession = useCallback(async () => {
    if (!selectedClassId || !selectedDate) {
      setSession(null)
      setAttendance([])
      return
    }
    setLoadingAttendance(true)
    try {
      const res = await fetch(`/api/classes/sessions?classId=${selectedClassId}&date=${selectedDate}`)
      const data = await res.json()
      setSession(data.session || null)
      if (data.session) {
        const aRes = await fetch(`/api/classes/attendance?sessionId=${data.session.id}`)
        const aData = await aRes.json()
        setAttendance(aData.attendance || [])
      } else {
        setAttendance([])
      }
    } catch {
      // ignore
    } finally {
      setLoadingAttendance(false)
    }
  }, [selectedClassId, selectedDate])

  useEffect(() => {
    fetchSession()
  }, [fetchSession])

  async function ensureSession(): Promise<Session | null> {
    if (session) return session
    if (!selectedClassId || !selectedDate) return null
    try {
      const res = await fetch('/api/classes/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ class_id: selectedClassId, session_date: selectedDate }),
      })
      const data = await res.json()
      setSession(data.session)
      return data.session
    } catch {
      return null
    }
  }

  async function handleAddPerson() {
    if (!newName.trim()) return
    setAddingPerson(true)
    try {
      const s = await ensureSession()
      if (!s) return
      const res = await fetch('/api/classes/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: s.id, customer_name: newName.trim(), status: 'present' }),
      })
      const data = await res.json()
      setAttendance(prev => [...prev, data.attendance])
      setNewName('')
    } catch {
      // ignore
    } finally {
      setAddingPerson(false)
    }
  }

  async function handleStatusChange(record: AttendanceRecord, status: 'present' | 'absent' | 'late') {
    try {
      const res = await fetch(`/api/classes/attendance?id=${record.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const data = await res.json()
      setAttendance(prev => prev.map(a => a.id === record.id ? data.attendance : a))
    } catch {
      // ignore
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/classes/attendance?id=${id}`, { method: 'DELETE' })
      setAttendance(prev => prev.filter(a => a.id !== id))
    } catch {
      // ignore
    }
  }

  const selectedClass = classes.find(c => c.id === selectedClassId)
  const presentCount = attendance.filter(a => a.status === 'present').length
  const lateCount = attendance.filter(a => a.status === 'late').length
  const absentCount = attendance.filter(a => a.status === 'absent').length

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Users className="h-7 w-7 text-indigo-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devam Takibi</h1>
          <p className="text-sm text-gray-500">Seans katılım kaydı</p>
        </div>
      </div>

      {/* Date & Class selectors */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 mb-6 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tarih</label>
            <input
              type="date"
              value={selectedDate}
              onChange={e => {
                setSelectedDate(e.target.value)
                setSelectedClassId('')
                setSession(null)
                setAttendance([])
              }}
              className="w-full border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Class */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Sınıf</label>
            {loadingClasses ? (
              <div className="text-sm text-gray-400 py-2">Yükleniyor...</div>
            ) : (
              <CustomSelect
                options={classesForDay.map(cls => ({ value: cls.id, label: `${cls.name} — ${cls.start_time.slice(0, 5)}` }))}
                value={selectedClassId}
                onChange={v => setSelectedClassId(v)}
                placeholder={classesForDay.length === 0 ? 'Bu gün için sınıf yok' : 'Sınıf seçin...'}
              />
            )}
          </div>
        </div>

        {/* Selected class info */}
        {selectedClass && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100 dark:border-gray-700">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedClass.color }} />
            <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-gray-100">{selectedClass.name}</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {selectedClass.start_time.slice(0, 5)} · {selectedClass.duration_minutes}dk
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {selectedClass.capacity} kişi kapasite
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Attendance section */}
      {selectedClassId && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Summary bar */}
          <div className="flex items-center gap-6 px-4 py-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <div className="flex items-center gap-1.5">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium text-green-700">Geldi: {presentCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium text-yellow-700">Geç Geldi: {lateCount}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <XCircle className="h-4 w-4 text-red-400" />
              <span className="text-sm font-medium text-red-600">Gelmedi: {absentCount}</span>
            </div>
            <span className="ml-auto text-xs text-gray-400">Toplam: {attendance.length}</span>
          </div>

          {/* Add person */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPerson()}
              placeholder="Katılımcı adı ekle..."
              className="flex-1 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={handleAddPerson}
              disabled={addingPerson || !newName.trim()}
              className="flex items-center gap-1.5 bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Ekle
            </button>
          </div>

          {/* Attendance list */}
          {loadingAttendance ? (
            <div className="py-10 text-center text-gray-400 text-sm">Yükleniyor...</div>
          ) : attendance.length === 0 ? (
            <div className="py-10 text-center text-gray-400 text-sm">
              Henüz katılımcı eklenmemiş.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {attendance.map(record => (
                <li key={record.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
                  <span className="text-sm font-medium text-gray-900">{record.customer_name}</span>
                  <div className="flex items-center gap-2">
                    {/* Status buttons */}
                    <button
                      onClick={() => handleStatusChange(record, 'present')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        record.status === 'present'
                          ? 'bg-green-100 text-green-700 ring-1 ring-green-400'
                          : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
                      }`}
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                      Geldi
                    </button>
                    <button
                      onClick={() => handleStatusChange(record, 'late')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        record.status === 'late'
                          ? 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-400'
                          : 'bg-gray-100 text-gray-500 hover:bg-yellow-50 hover:text-yellow-600'
                      }`}
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                      Geç
                    </button>
                    <button
                      onClick={() => handleStatusChange(record, 'absent')}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                        record.status === 'absent'
                          ? 'bg-red-100 text-red-600 ring-1 ring-red-400'
                          : 'bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500'
                      }`}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Gelmedi
                    </button>
                    <button
                      onClick={() => handleDelete(record.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors ml-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!selectedClassId && !loadingClasses && (
        <div className="text-center py-16 text-gray-400">
          <Users className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Devam takibi yapmak için tarih ve sınıf seçin.</p>
        </div>
      )}
    </div>
  )
}

export default function AttendancePageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-400">Yükleniyor...</div>}>
      <AttendancePage />
    </Suspense>
  )
}
