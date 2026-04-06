'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import {
  Plus,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Pencil,
  CalendarClock,
  LayoutList,
  LayoutGrid,
  Phone,
  Trash2,
  Repeat,
  CalendarDays,
  CalendarRange,
  Search, Filter, ArrowUpDown,
} from 'lucide-react'
import { formatTime, formatDate, getStatusColor, formatCurrency, cn, getInitials, getAvatarColor } from '@/lib/utils'
import { STATUS_LABELS, type AppointmentStatus, type Customer, type Service, type StaffMember, type WorkingHours } from '@/types'
import { logAudit } from '@/lib/utils/audit'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { ToolbarPopover, SortPopoverContent, FilterPopoverList } from '@/components/ui/toolbar-popover'
import { CustomSelect } from '@/components/ui/custom-select'

export default function AppointmentsPage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, loading: ctxLoading } = useBusinessContext()
  const { confirm } = useConfirm()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [now, setNow] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useViewMode('appointments', 'list')
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null)
  const [panelClosing, setPanelClosing] = useState(false)
  const closePanelAnimated = useCallback(() => setPanelClosing(true), [])
  const [showModal, setShowModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any | null>(null)
  const [cancelConfirmAppointment, setCancelConfirmAppointment] = useState<any | null>(null)
  const [cancelNotifyCustomer, setCancelNotifyCustomer] = useState(true)
  const [slotPopup, setSlotPopup] = useState<{ day: string; hour: number; apts: any[]; x: number; y: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('09:00')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [staffIdFilter, setStaffIdFilter] = useState('')
  const [serviceIdFilter, setServiceIdFilter] = useState('')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string } | null> | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [notes, setNotes] = useState('')

  // Tekrarlayan randevu state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [recurrenceCount, setRecurrenceCount] = useState(4)

  const supabase = createClient()

  // Hafta hesaplama yardımcıları
  function getWeekRange(dateStr: string): { start: string; end: string } {
    const [y, m, d] = dateStr.split('-').map(Number)
    const dt = new Date(y, m - 1, d)
    const day = dt.getDay() // 0=Pazar
    const mondayOffset = day === 0 ? -6 : 1 - day
    const monday = new Date(dt)
    monday.setDate(dt.getDate() + mondayOffset)
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    return { start: fmt(monday), end: fmt(sunday) }
  }

  function getWeekDays(dateStr: string): string[] {
    const { start } = getWeekRange(dateStr)
    const [y, m, d] = start.split('-').map(Number)
    const monday = new Date(y, m - 1, d)
    return Array.from({ length: 7 }, (_, i) => {
      const dt = new Date(monday)
      dt.setDate(monday.getDate() + i)
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    })
  }

  // Aylık takvim için: ayın ilk gününü kapsayan haftanın Pazartesi'sinden,
  // ayın son gününü kapsayan haftanın Pazar'ına kadar 6×7=42 gün döndürür
  function getMonthGridDays(dateStr: string): string[] {
    const [y, m] = dateStr.split('-').map(Number)
    const firstOfMonth = new Date(y, m - 1, 1)
    const day = firstOfMonth.getDay() // 0=Pazar
    const mondayOffset = day === 0 ? -6 : 1 - day
    const gridStart = new Date(firstOfMonth)
    gridStart.setDate(firstOfMonth.getDate() + mondayOffset)
    return Array.from({ length: 42 }, (_, i) => {
      const dt = new Date(gridStart)
      dt.setDate(gridStart.getDate() + i)
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    })
  }

  function getMonthRange(dateStr: string): { start: string; end: string } {
    const days = getMonthGridDays(dateStr)
    return { start: days[0], end: days[days.length - 1] }
  }

  const fetchAppointments = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    let query = supabase
      .from('appointments')
      .select('*, customers(name, phone), services(name, duration_minutes, price), staff_members(name)')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .order('start_time', { ascending: true })

    if (viewMode === 'week') {
      const { start, end } = getWeekRange(selectedDate)
      query = query.gte('appointment_date', start).lte('appointment_date', end)
    } else if (viewMode === 'month') {
      const { start, end } = getMonthRange(selectedDate)
      query = query.gte('appointment_date', start).lte('appointment_date', end)
    } else {
      query = query.eq('appointment_date', selectedDate)
    }

    const { data, error } = await query
    if (data) setAppointments(data)
    if (error) console.error('Randevu çekme hatası:', error)
    setLoading(false)
  }, [selectedDate, businessId, viewMode])

  const fetchFormData = useCallback(async () => {
    if (!businessId) return
    const [custRes, svcRes, staffRes, bizRes] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      supabase.from('staff_members').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('businesses').select('working_hours').eq('id', businessId).single(),
    ])
    if (custRes.data) setCustomers(custRes.data)
    if (svcRes.data) setServices(svcRes.data)
    if (staffRes.data) setStaffMembers(staffRes.data)
    if (bizRes.data?.working_hours) setWorkingHours(bizRes.data.working_hours)
  }, [businessId])

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { if (!ctxLoading) fetchAppointments() }, [fetchAppointments, ctxLoading])
  useEffect(() => { if (!ctxLoading) fetchFormData() }, [fetchFormData, ctxLoading])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  function changeDate(days: number) {
    const d = new Date(selectedDate + 'T12:00:00')
    if (viewMode === 'month') {
      d.setMonth(d.getMonth() + days)
    } else if (viewMode === 'week') {
      d.setDate(d.getDate() + days * 7)
    } else {
      d.setDate(d.getDate() + days)
    }
    setSelectedDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }

  function formatMonthLabel() {
    const [y, m] = selectedDate.split('-').map(Number)
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    return `${months[m - 1]} ${y}`
  }

  function goToday() { setSelectedDate(new Date().toISOString().split('T')[0]) }

  const effectiveNow = now ?? new Date()
  const todayStr = `${effectiveNow.getFullYear()}-${String(effectiveNow.getMonth() + 1).padStart(2, '0')}-${String(effectiveNow.getDate()).padStart(2, '0')}`
  const isToday = selectedDate === todayStr
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : -1

  function getTimeState(apt: any): 'past' | 'current' | 'future' {
    if (selectedDate < todayStr) return 'past'
    if (selectedDate > todayStr) return 'future'
    const toMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
    const start = toMinutes(apt.start_time)
    const end = toMinutes(apt.end_time)
    if (end <= nowMinutes) return 'past'
    if (start <= nowMinutes && nowMinutes < end) return 'current'
    return 'future'
  }

  function formatSelectedDate() {
    const d = new Date(selectedDate + 'T00:00:00')
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`
  }

  function formatWeekRange() {
    const days = getWeekDays(selectedDate)
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    const [sy, sm, sd] = days[0].split('-').map(Number)
    const [ey, em, ed] = days[6].split('-').map(Number)
    if (sm === em) return `${sd} – ${ed} ${months[sm - 1]} ${sy}`
    return `${sd} ${months[sm - 1]} – ${ed} ${months[em - 1]} ${ey}`
  }

  function openNewModal(overrideDate?: string, overrideTime?: string) {
    setEditingAppointment(null)
    setCustomerId(''); setServiceId(''); setStaffId('')
    setDate(overrideDate || selectedDate); setStartTime(overrideTime || '09:00'); setNotes('')
    setIsRecurring(false); setRecurrenceFrequency('weekly'); setRecurrenceCount(4)
    setError(null); setShowModal(true)
  }

  function openEditModal(apt: any, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingAppointment(apt)
    setCustomerId(apt.customer_id); setServiceId(apt.service_id || ''); setStaffId(apt.staff_id || '')
    setDate(apt.appointment_date); setStartTime(apt.start_time); setNotes(apt.notes || '')
    setIsRecurring(false)
    setError(null); setShowModal(true)
  }

  function openRescheduleModal(apt: any, e?: React.MouseEvent) {
    e?.stopPropagation()
    setRescheduleAppointment(apt)
    setRescheduleDate(apt.appointment_date)
    setRescheduleTime(apt.start_time)
    setError(null)
  }

  function openCancelConfirm(apt: any, e?: React.MouseEvent) {
    e?.stopPropagation()
    setCancelConfirmAppointment(apt)
    setCancelNotifyCustomer(true)
  }

  function calculateEndTime(start: string, durationMinutes: number): string {
    const [h, m] = start.split(':').map(Number)
    const totalMin = h * 60 + m + durationMinutes
    return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`
  }

  function timeRangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
    const toMin = (t: string) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m }
    return toMin(aStart) < toMin(bEnd) && toMin(bStart) < toMin(aEnd)
  }

  async function checkStaffConflict(
    staffIdVal: string | null, appointmentDate: string,
    startTimeVal: string, endTimeVal: string, excludeId: string | null
  ): Promise<boolean> {
    if (!staffIdVal) return false
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('business_id', businessId)
      .eq('staff_id', staffIdVal)
      .eq('appointment_date', appointmentDate)
      .in('status', ['pending', 'confirmed'])
    if (!existing?.length) return false
    return existing.some(apt => {
      if (excludeId && apt.id === excludeId) return false
      return timeRangesOverlap(startTimeVal, endTimeVal, apt.start_time, apt.end_time)
    })
  }

  function generateRecurringDates(startDate: string, frequency: string, count: number): string[] {
    const dates: string[] = []
    const [y, m, d] = startDate.split('-').map(Number)
    const baseDate = new Date(y, m - 1, d)
    for (let i = 0; i < count; i++) {
      const dt = new Date(baseDate)
      if (frequency === 'weekly') dt.setDate(baseDate.getDate() + i * 7)
      else if (frequency === 'biweekly') dt.setDate(baseDate.getDate() + i * 14)
      else if (frequency === 'monthly') dt.setMonth(baseDate.getMonth() + i)
      const dateStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      dates.push(dateStr)
    }
    return dates
  }

  function getRecurrenceSummary(): string {
    const labels: Record<string, string> = { weekly: 'Her hafta', biweekly: 'Her 2 haftada bir', monthly: 'Her ay' }
    const dates = generateRecurringDates(date, recurrenceFrequency, recurrenceCount)
    const lastDate = dates[dates.length - 1]
    if (!lastDate) return ''
    const [ly, lm, ld] = lastDate.split('-').map(Number)
    const lastDt = new Date(ly, lm - 1, ld)
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    return `${labels[recurrenceFrequency]}, ${recurrenceCount} seans (${lastDt.getDate()} ${months[lastDt.getMonth()]}'a kadar)`
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)
    const selectedService = services.find(s => s.id === serviceId)
    const duration = selectedService?.duration_minutes || 30
    const endTime = calculateEndTime(startTime, duration)
    const payload = {
      customer_id: customerId, service_id: serviceId || null, staff_id: staffId || null,
      appointment_date: date, start_time: startTime, end_time: endTime, notes: notes || null,
    }
    const conflict = await checkStaffConflict(staffId || null, date, startTime, endTime, editingAppointment?.id ?? null)
    if (conflict) { setError('Bu personelin bu saatte başka bir randevusu var.'); setSaving(false); return }

    if (editingAppointment) {
      const { error } = await supabase.from('appointments').update(payload).eq('id', editingAppointment.id)
      if (error) { setError(error.message.includes('başka bir randevusu var') ? 'Bu personelin bu saatte başka bir randevusu var.' : error.message); setSaving(false); return }
    } else if (isRecurring && recurrenceCount > 1) {
      // Tekrarlayan randevu: Toplu oluşturma
      const groupId = crypto.randomUUID()
      const dates = generateRecurringDates(date, recurrenceFrequency, recurrenceCount)
      const conflictDates: string[] = []

      // Çakışma kontrolü
      for (const d of dates) {
        const hasConflict = await checkStaffConflict(staffId || null, d, startTime, endTime, null)
        if (hasConflict) conflictDates.push(d)
      }

      const validDates = dates.filter(d => !conflictDates.includes(d))

      if (validDates.length === 0) {
        setError('Tüm tarihlerde çakışma var. Farklı saat veya personel seçin.')
        setSaving(false)
        return
      }

      const insertPayloads = validDates.map(d => ({
        business_id: businessId,
        customer_id: customerId,
        service_id: serviceId || null,
        staff_id: staffId || null,
        appointment_date: d,
        start_time: startTime,
        end_time: endTime,
        notes: notes || null,
        status: 'confirmed' as const,
        source: 'manual' as const,
        recurrence_group_id: groupId,
        recurrence_pattern: { frequency: recurrenceFrequency, count: recurrenceCount },
      }))

      const { error } = await supabase.from('appointments').insert(insertPayloads)
      if (error) { setError(error.message); setSaving(false); return }

      if (conflictDates.length > 0) {
        const skipped = conflictDates.map(d => {
          const [y, m, dd] = d.split('-').map(Number)
          return `${dd}/${m}`
        }).join(', ')
        alert(`${validDates.length} randevu oluşturuldu. ${conflictDates.length} tarih çakışma nedeniyle atlandı: ${skipped}`)
      }
    } else {
      const { error } = await supabase.from('appointments').insert({ business_id: businessId, ...payload, status: 'confirmed', source: 'manual' })
      if (error) { setError(error.message.includes('başka bir randevusu var') ? 'Bu personelin bu saatte başka bir randevusu var.' : error.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false)
    await fetchAppointments()
    const auditCustomer = customers.find(c => c.id === customerId)
    const auditService = services.find(s => s.id === serviceId)
    const auditStaff = staffMembers.find(s => s.id === staffId)
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: editingAppointment ? 'update' : 'create',
      resource: 'appointment',
      resourceId: editingAppointment?.id,
      details: {
        customer_name: auditCustomer?.name || null,
        service_name: auditService?.name || null,
        staff_name: auditStaff?.name || null,
        date,
        time: startTime,
        recurring: isRecurring && !editingAppointment ? recurrenceCount : null,
      },
    })
  }

  // Drag-drop ile randevuyu yeni tarihe taşı (aylık/haftalık takvim)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  async function handleDragMove(appointmentId: string, newDate: string, newStartTime?: string) {
    if (!businessId) return
    const apt = appointments.find(a => a.id === appointmentId)
    if (!apt) return
    // Aynı tarih + saat ise işlem yapma
    if (apt.appointment_date === newDate && (!newStartTime || apt.start_time === newStartTime)) return

    try {
      const res = await fetch(`/api/appointments/${appointmentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          appointment_date: newDate,
          ...(newStartTime ? { start_time: newStartTime } : {}),
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: {
            type: 'error',
            title: 'Randevu Taşınamadı',
            body: j.error || 'Bir hata oluştu, lütfen tekrar deneyin.',
          },
        }))
        return
      }
      await fetchAppointments()
      await logAudit({
        businessId: businessId!,
        staffId: currentStaffId,
        staffName: currentStaffName,
        action: 'update',
        resource: 'appointment',
        resourceId: appointmentId,
        details: {
          customer_name: apt.customers?.name || null,
          service_name: apt.services?.name || null,
          from_date: apt.appointment_date,
          to_date: newDate,
          ...(newStartTime ? { from_time: apt.start_time, to_time: newStartTime } : {}),
          via: 'drag-drop',
        },
      })
    } catch (err) {
      console.error('drag-drop hatası:', err)
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: {
          type: 'error',
          title: 'Randevu Taşınamadı',
          body: 'Bir hata oluştu, lütfen tekrar deneyin.',
        },
      }))
    }
  }

  async function handleRescheduleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!rescheduleAppointment) return
    setSaving(true); setError(null)
    const selectedService = services.find(s => s.id === rescheduleAppointment.service_id)
    const duration = selectedService?.duration_minutes || 30
    const endTime = calculateEndTime(rescheduleTime, duration)
    const conflict = await checkStaffConflict(rescheduleAppointment.staff_id ?? null, rescheduleDate, rescheduleTime, endTime, rescheduleAppointment.id)
    if (conflict) { setError('Bu personelin bu saatte başka bir randevusu var.'); setSaving(false); return }
    const { error } = await supabase.from('appointments').update({ appointment_date: rescheduleDate, start_time: rescheduleTime, end_time: endTime }).eq('id', rescheduleAppointment.id)
    if (error) { setError(error.message); setSaving(false); return }
    setSaving(false); setRescheduleAppointment(null); fetchAppointments()
  }

  async function handleCancelConfirm() {
    if (!cancelConfirmAppointment) return
    setSaving(true)
    const apt = cancelConfirmAppointment
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', apt.id)
    if (error) { alert('İptal güncellenemedi: ' + error.message); setSaving(false); setCancelConfirmAppointment(null); return }
    if (cancelNotifyCustomer && apt.customer_id) {
      try {
        await fetch('/api/messages/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ businessId, customerId: apt.customer_id, content: 'Merhaba, randevunuz iptal edilmiştir. Sorularınız için bizi arayabilirsiniz.' }) })
      } catch { /* bildirim hatası randevu iptalini geri almaz */ }
    }
    // Bildirim: randevu iptal edildi
    try {
      await supabase.from('notifications').insert({
        business_id: businessId,
        type: 'appointment',
        title: 'Randevu İptal Edildi',
        body: `${apt.customers?.name || 'Müşteri'} — ${apt.services?.name || ''} — ${apt.appointment_date} ${apt.start_time}`,
        is_read: false,
      })
    } catch { /* */ }
    setSaving(false); setCancelConfirmAppointment(null)
    if (selectedAppointment?.id === apt.id) setSelectedAppointment(null)
    fetchAppointments()
  }

  async function handleDeleteAppointment(appointmentId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const ok = await confirm({ title: 'Onay', message: 'Bu randevuyu kalıcı olarak silmek istediğinizden emin misiniz?' })
    if (!ok) return
    const { error } = await supabase
      .from('appointments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', appointmentId)
    if (error) { alert('Silme hatası: ' + error.message); return }
    const deletedApt = appointments.find(a => a.id === appointmentId)
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: 'delete',
      resource: 'appointment',
      resourceId: appointmentId,
      details: {
        customer_name: deletedApt?.customers?.name || null,
        service_name: deletedApt?.services?.name || null,
        date: deletedApt?.appointment_date || null,
        time: deletedApt?.start_time || null,
      },
    })
    if (selectedAppointment?.id === appointmentId) setSelectedAppointment(null)
    fetchAppointments()
  }

  async function updateStatus(appointmentId: string, newStatus: AppointmentStatus, e?: React.MouseEvent) {
    e?.stopPropagation()
    const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId)
    if (error) {
      if (error.message.includes('segment') && error.message.includes('customer_segment')) {
        alert('Randevu güncellemesi veritabanı ayarı nedeniyle başarısız.\n\nDüzeltmek için:\n1. Supabase Dashboard → SQL Editor\'ü açın.\n2. supabase/migrations/003_fix_appointment_customer_segment.sql dosyasını çalıştırın.')
      } else {
        alert('Güncelleme hatası: ' + error.message)
      }
      return
    }
    // Detay panelindeki randevuyu güncelle
    if (selectedAppointment?.id === appointmentId) {
      setSelectedAppointment((prev: any) => prev ? { ...prev, status: newStatus } : null)
    }
    const statusApt = appointments.find(a => a.id === appointmentId)
    await logAudit({
      businessId: businessId!,
      staffId: currentStaffId,
      staffName: currentStaffName,
      action: 'status_change',
      resource: 'appointment',
      resourceId: appointmentId,
      details: {
        from: statusApt?.status || null,
        to: newStatus,
        customer_name: statusApt?.customers?.name || null,
        service_name: statusApt?.services?.name || null,
      },
    })
    // Randevu tamamlandığında müşterinin aktif paketinden seans düş
    if (newStatus === 'completed' && statusApt?.customer_id) {
      const { data: activePkgs } = await supabase
        .from('customer_packages')
        .select('id, sessions_used, sessions_total')
        .eq('business_id', businessId!)
        .eq('customer_id', statusApt.customer_id)
        .eq('status', 'active')
        .order('purchase_date', { ascending: true })
        .limit(1)
      if (activePkgs && activePkgs.length > 0) {
        const pkg = activePkgs[0]
        const newUsed = pkg.sessions_used + 1
        const newPkgStatus = newUsed >= pkg.sessions_total ? 'completed' : 'active'
        await supabase
          .from('customer_packages')
          .update({ sessions_used: newUsed, status: newPkgStatus })
          .eq('id', pkg.id)
        await supabase.from('package_usages').insert({
          business_id: businessId,
          customer_package_id: pkg.id,
          appointment_id: appointmentId,
          staff_id: currentStaffId || null,
          notes: 'Randevu tamamlandı — otomatik seans düşümü',
        })
      }
    }
    fetchAppointments()
  }

  function getDayKeyFromDate(dateStr: string): keyof WorkingHours {
    const dayMap: Record<number, keyof WorkingHours> = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    }
    const d = new Date(dateStr + 'T00:00:00')
    return dayMap[d.getDay()]
  }

  function generateTimeSlots(dateStr?: string, wh?: Record<string, { open: string; close: string } | null> | null): string[] {
    if (dateStr && wh) {
      const dayKey = getDayKeyFromDate(dateStr)
      const dayHours = wh[dayKey]
      if (!dayHours) return [] // kapalı gün
      const [openH, openM] = dayHours.open.split(':').map(Number)
      const [closeH, closeM] = dayHours.close.split(':').map(Number)
      const openTotal = openH * 60 + openM
      const closeTotal = closeH * 60 + closeM
      const slots: string[] = []
      for (let t = openTotal; t < closeTotal; t += 30) {
        const hh = Math.floor(t / 60)
        const mm = t % 60
        slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
      }
      return slots
    }
    // Fallback: 08:00 - 21:30
    const slots: string[] = []
    for (let h = 8; h <= 21; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }

  const hasActiveFilters = !!(staffIdFilter || serviceIdFilter)
  const filteredAppointments = (() => {
    let list = appointments.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false
      if (staffIdFilter && a.staff_id !== staffIdFilter) return false
      if (serviceIdFilter && a.service_id !== serviceIdFilter) return false
      if (!search.trim()) return true
      const q = search.toLowerCase()
      return (
        a.customers?.name?.toLowerCase().includes(q) ||
        a.services?.name?.toLowerCase().includes(q) ||
        a.staff_members?.name?.toLowerCase().includes(q) ||
        a.notes?.toLowerCase().includes(q)
      )
    })
    if (sortField) {
      list = [...list].sort((a, b) => {
        let va: any, vb: any
        if (sortField === 'customer_name') { va = a.customers?.name; vb = b.customers?.name }
        else if (sortField === 'service_name') { va = a.services?.name; vb = b.services?.name }
        else { va = (a as any)[sortField]; vb = (b as any)[sortField] }
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  })()

  const totalCount = appointments.length
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length
  const completedCount = appointments.filter(a => a.status === 'completed').length
  const noShowCount = appointments.filter(a => a.status === 'no_show').length

  // Aksiyon butonları — hem liste hem kutu görünümünde kullanılır
  function ActionButtons({ apt, size = 'md' }: { apt: any; size?: 'sm' | 'md' }) {
    const btnCls = size === 'sm'
      ? 'flex h-7 w-7 items-center justify-center rounded-lg transition-colors'
      : 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors'
    const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'

    return (
      <div className="flex items-center gap-1">
        {(apt.status === 'confirmed' || apt.status === 'pending') && (
          <>
            <button onClick={(e) => openEditModal(apt, e)} title="Düzenle" className={cn(btnCls, 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>
              <Pencil className={iconCls} />
            </button>
            <button onClick={(e) => openRescheduleModal(apt, e)} title="Ertele" className={cn(btnCls, 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30')}>
              <CalendarClock className={iconCls} />
            </button>
          </>
        )}
        {apt.status === 'confirmed' && (
          <>
            <button onClick={(e) => updateStatus(apt.id, 'completed', e)} title="Tamamlandı" className={cn(btnCls, 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30')}>
              <CheckCircle className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
            <button onClick={(e) => updateStatus(apt.id, 'no_show', e)} title="Gelmedi" className={cn(btnCls, 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30')}>
              <AlertTriangle className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
            <button onClick={(e) => openCancelConfirm(apt, e)} title="İptal" className={cn(btnCls, 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700')}>
              <XCircle className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
            </button>
          </>
        )}
        {(apt.status === 'no_show' || apt.status === 'cancelled') && (
          <>
            <button
              onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'confirmed') }}
              className={cn(
                'flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40',
                size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm'
              )}
            >
              <CheckCircle className={iconCls} /> Aktif Et
            </button>
            <button
              onClick={(e) => handleDeleteAppointment(apt.id, e)}
              title="Sil"
              className={cn(btnCls, 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30')}
            >
              <Trash2 className={iconCls} />
            </button>
          </>
        )}
        {apt.status === 'pending' && (
          <button
            onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'confirmed') }}
            className={cn(
              'flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm'
            )}
          >
            <CheckCircle className={iconCls} /> Onayla
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Randevular</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{totalCount} randevu</p>
        </div>
        <button onClick={() => openNewModal()} className="btn-primary shrink-0">
          <Plus className="mr-2 h-4 w-4" />Yeni Randevu
        </button>
      </div>

      {/* Tarih Navigasyonu + Saat */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1 card !p-0 overflow-hidden">
          <div className="flex items-center">
            <button onClick={() => changeDate(-1)} className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="flex-1 text-center py-2.5 min-w-0">
              {viewMode === 'week' ? (
                <>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{formatWeekRange()}</p>
                  <button onClick={goToday} className="text-xs text-pulse-900 dark:text-pulse-400 hover:underline mt-0.5">Bu Haftaya Dön</button>
                </>
              ) : viewMode === 'month' ? (
                <>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{formatMonthLabel()}</p>
                  <button onClick={goToday} className="text-xs text-pulse-900 dark:text-pulse-400 hover:underline mt-0.5">Bu Aya Dön</button>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100 truncate">{formatSelectedDate()}</p>
                  {!isToday
                    ? <button onClick={goToday} className="text-xs text-pulse-900 dark:text-pulse-400 hover:underline mt-0.5">Bugüne Dön</button>
                    : <p className="text-xs text-pulse-900 dark:text-pulse-400 mt-0.5">Bugün</p>}
                </>
              )}
            </div>
            <button onClick={() => changeDate(1)} className="flex h-12 w-12 flex-shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-600 transition-colors">
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Current time pill */}
        <div className="flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-800 px-4 py-2.5 shadow-sm self-center">
          <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="text-base font-bold tabular-nums text-white">
            {now ? now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
          </span>
        </div>
      </div>

      {/* Mini İstatistik + Görünüm butonları */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid flex-1 grid-cols-4 gap-2">
          <button onClick={() => setStatusFilter(null)} className={cn('rounded-2xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50 p-3 text-center transition-all hover:shadow-sm', statusFilter === null && 'ring-2 ring-gray-400 dark:ring-gray-500')}><p className="text-xl font-bold text-gray-900 dark:text-gray-100">{totalCount}</p><p className="text-xs text-gray-500 mt-0.5">Toplam</p></button>
          <button onClick={() => setStatusFilter(statusFilter === 'confirmed' ? null : 'confirmed')} className={cn('rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-blue-50 dark:bg-blue-950/30 p-3 text-center transition-all hover:shadow-sm', statusFilter === 'confirmed' && 'ring-2 ring-blue-500')}><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{confirmedCount}</p><p className="text-xs text-gray-500 mt-0.5">Onaylı</p></button>
          <button onClick={() => setStatusFilter(statusFilter === 'completed' ? null : 'completed')} className={cn('rounded-2xl border border-green-100 dark:border-green-900/40 bg-green-50 dark:bg-green-950/30 p-3 text-center transition-all hover:shadow-sm', statusFilter === 'completed' && 'ring-2 ring-green-500')}><p className="text-xl font-bold text-green-600 dark:text-green-400">{completedCount}</p><p className="text-xs text-gray-500 mt-0.5">Tamamlandı</p></button>
          <button onClick={() => setStatusFilter(statusFilter === 'no_show' ? null : 'no_show')} className={cn('rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-3 text-center transition-all hover:shadow-sm', statusFilter === 'no_show' && 'ring-2 ring-red-500')}><p className="text-xl font-bold text-red-600 dark:text-red-400">{noShowCount}</p><p className="text-xs text-gray-500 mt-0.5">Gelmedi</p></button>
        </div>
        <div className="flex justify-end">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
            <ToolbarPopover icon={<Filter className="h-4 w-4" />} label="Filtre" active={hasActiveFilters}>
              <div className="p-3 w-52 space-y-3">
                <FilterPopoverList
                  label="Personel"
                  options={staffMembers.map(s => ({ value: s.id, label: s.name }))}
                  value={staffIdFilter}
                  onChange={setStaffIdFilter}
                />
                <div className="border-t border-gray-100 dark:border-gray-700" />
                <FilterPopoverList
                  label="Hizmet"
                  options={services.map(s => ({ value: s.id, label: s.name }))}
                  value={serviceIdFilter}
                  onChange={setServiceIdFilter}
                />
                {hasActiveFilters && (
                  <div className="border-t border-gray-100 dark:border-gray-700 pt-2">
                    <button onClick={() => { setStaffIdFilter(''); setServiceIdFilter('') }}
                      className="w-full text-xs text-center py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center justify-center gap-1">
                      <X className="h-3 w-3" /> Temizle
                    </button>
                  </div>
                )}
              </div>
            </ToolbarPopover>
            <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
              <SortPopoverContent
                options={[
                  { value: 'start_time', label: 'Saat' },
                  { value: 'customer_name', label: 'Müşteri adı' },
                  { value: 'service_name', label: 'Hizmet' },
                ]}
                sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir}
              />
            </ToolbarPopover>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button type="button" onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste görünüm"><LayoutList className="h-4 w-4" /></button>
            <button type="button" onClick={() => setViewMode('week')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'week' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Haftalık takvim"><CalendarDays className="h-4 w-4" /></button>
            <button type="button" onClick={() => setViewMode('month')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'month' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Aylık takvim"><CalendarRange className="h-4 w-4" /></button>
            <button type="button" onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutu görünüm"><LayoutGrid className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {/* Arama (liste/kutu modunda) */}
      {viewMode !== 'week' && viewMode !== 'month' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder="Müşteri, hizmet veya personel ara..." />
        </div>
      )}

      {/* Randevu Listesi / Takvim */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
        </div>
      ) : viewMode === 'week' ? (
        /* ── Haftalık Takvim Görünümü ── */
        (() => {
          const weekDays = getWeekDays(selectedDate)
          const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
          // Çalışma saatlerini working_hours'tan hesapla
          const dayKeyMap = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
          let startHour = 8
          let endHour = 21
          if (workingHours) {
            const openHours = dayKeyMap.map(k => workingHours[k]?.open).filter(Boolean).map(t => parseInt(t!.split(':')[0]))
            const closeHours = dayKeyMap.map(k => workingHours[k]?.close).filter(Boolean).map(t => parseInt(t!.split(':')[0]))
            if (openHours.length > 0) startHour = Math.min(...openHours)
            if (closeHours.length > 0) endHour = Math.max(...closeHours)
          }
          const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour)
          const staffColors = ['bg-blue-200 dark:bg-blue-800', 'bg-green-200 dark:bg-green-800', 'bg-purple-200 dark:bg-purple-800', 'bg-amber-200 dark:bg-amber-800', 'bg-pink-200 dark:bg-pink-800', 'bg-cyan-200 dark:bg-cyan-800', 'bg-orange-200 dark:bg-orange-800', 'bg-rose-200 dark:bg-rose-800']
          const staffTextColors = ['text-blue-800 dark:text-blue-200', 'text-green-800 dark:text-green-200', 'text-purple-800 dark:text-purple-200', 'text-amber-800 dark:text-amber-200', 'text-pink-800 dark:text-pink-200', 'text-cyan-800 dark:text-cyan-200', 'text-orange-800 dark:text-orange-200', 'text-rose-800 dark:text-rose-200']

          function getStaffColorIndex(sId: string | null): number {
            if (!sId) return 0
            const idx = staffMembers.findIndex(s => s.id === sId)
            return idx >= 0 ? idx % staffColors.length : 0
          }

          // Çakışan randevuları yan yana kolon olarak düzenle
          function computeOverlapLayout(dayApts: typeof appointments) {
            if (dayApts.length === 0) return []
            const sorted = [...dayApts].sort((a, b) => a.start_time.localeCompare(b.start_time))
            const columns: { endTime: string }[] = []
            const assignments: { apt: typeof dayApts[0]; column: number }[] = []
            for (const apt of sorted) {
              let placed = false
              for (let col = 0; col < columns.length; col++) {
                if (apt.start_time >= columns[col].endTime) {
                  columns[col].endTime = apt.end_time
                  assignments.push({ apt, column: col })
                  placed = true; break
                }
              }
              if (!placed) {
                assignments.push({ apt, column: columns.length })
                columns.push({ endTime: apt.end_time })
              }
            }
            return assignments.map(assignment => {
              const overlapping = assignments.filter(other =>
                other.apt.start_time < assignment.apt.end_time &&
                other.apt.end_time > assignment.apt.start_time
              )
              return { apt: assignment.apt, column: assignment.column, totalColumns: Math.max(...overlapping.map(o => o.column)) + 1 }
            })
          }

          // Hesapla: her saat 60px yükseklik
          const hourHeight = 60
          const topPad = 0 // header border-b çizgisi separator görevi görüyor
          const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

          return (
            <div className="card overflow-hidden !p-0">
              <div className="overflow-x-auto overflow-y-auto">
                <div className="min-w-[800px] relative">

                  {/* ── TEK arka plan grid — header + body ikisini birden kapsar ── */}
                  <div className="absolute inset-0 grid grid-cols-[60px_repeat(7,1fr)] pointer-events-none">
                    <div /> {/* saat etiketi alanı */}
                    {weekDays.map((day) => {
                      const isDayToday = day === todayStr
                      return (
                        <div
                          key={`bg-${day}`}
                          className={cn(
                            'border-l border-gray-200 dark:border-gray-700',
                            isDayToday && 'bg-pulse-50/40 dark:bg-pulse-900/20'
                          )}
                        />
                      )
                    })}
                  </div>

                  {/* Gün başlıkları */}
                  <div className="grid grid-cols-[60px_repeat(7,1fr)] relative">
                    <div className="p-2" />
                    {weekDays.map((day, i) => {
                      const [dy, dm, dd] = day.split('-').map(Number)
                      const isDayToday = day === todayStr
                      return (
                        <div
                          key={day}
                          className={cn(
                            'p-2 text-center',
                            isDayToday && 'bg-blue-50 dark:bg-blue-900/50'
                          )}
                        >
                          <p className="text-xs text-gray-500 dark:text-gray-400">{dayNames[i]}</p>
                          <p className={cn(
                            'text-lg font-bold',
                            isDayToday ? 'text-pulse-900' : 'text-gray-900 dark:text-gray-100'
                          )}>{dd}</p>
                        </div>
                      )
                    })}
                  </div>

                  {/* Saat grid'i */}
                  <div className="relative select-none" style={{ height: hours.length * hourHeight + topPad }}>

                    {/* Katman 1 KALDIRILDI — tek bg grid min-w-[800px] seviyesinde hallediyor */}

                    {/* ── Katman 2: Saat etiketleri — startHour y=2'de gösterilir ── */}
                    {hours.map((hour, i) => (
                      <div
                        key={`h-${hour}`}
                        className="absolute left-0 w-[60px] text-right pr-2 text-xs text-gray-400"
                        style={{ top: i === 0 ? 2 : i * hourHeight - 6 }}
                      >
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}

                    {/* ── Katman 3: Yatay çizgiler — y=0'daki çizgi header/body ayracı ── */}
                    {hours.map((hour, i) => (
                      <div
                        key={`line-${hour}`}
                        className="absolute left-[60px] right-0 border-t border-gray-100 dark:border-gray-800"
                        style={{ top: i * hourHeight }}
                      />
                    ))}

                    {/* ── Katman 4: Tıklama alanı + randevu blokları (arka plan yok — sadece etkileşim) ── */}
                    {weekDays.map((day, dayIdx) => {
                      const dayAppointments = appointments.filter(a => a.appointment_date === day)
                      const isDayToday = day === todayStr

                      return (
                        <div
                          key={`col-${day}`}
                          className="absolute"
                          style={{
                            left: `calc(60px + ${dayIdx} * ((100% - 60px) / 7))`,
                            width: `calc((100% - 60px) / 7)`,
                            top: topPad,
                            height: `calc(100% - ${topPad}px)`,
                          }}
                          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                          onDrop={(e) => {
                            e.preventDefault()
                            const id = e.dataTransfer.getData('text/plain')
                            if (!id) return
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            const dropY = e.clientY - rect.top
                            // En yakın saate snap (30 dk yerine 1 saat)
                            const dropHour = Math.max(startHour, Math.min(endHour - 1, Math.round(dropY / hourHeight) + startHour))
                            const timeStr = `${String(dropHour).padStart(2, '0')}:00`
                            handleDragMove(id, day, timeStr)
                          }}
                          onClick={(e) => {
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            const clickY = e.clientY - rect.top
                            const clickHour = Math.max(startHour, Math.min(endHour, Math.floor((clickY / hourHeight) + startHour)))
                            const timeStr = `${String(clickHour).padStart(2, '0')}:00`

                            if (dayAppointments.length > 0) {
                              const hourApts = dayAppointments.filter(a => {
                                const aHour = parseInt(a.start_time.split(':')[0])
                                return aHour === clickHour
                              })
                              if (hourApts.length > 0) {
                                setSlotPopup({ day, hour: clickHour, apts: hourApts, x: e.clientX, y: e.clientY })
                                return
                              }
                            }
                            openNewModal(day, timeStr)
                          }}
                        >
                          {/* Randevu blokları — çakışma tespiti ile yan yana kolon */}
                          {computeOverlapLayout(dayAppointments).map(({ apt, column, totalColumns }) => {
                            const startMin = toMinutes(apt.start_time) - startHour * 60
                            const endMin = toMinutes(apt.end_time) - startHour * 60
                            const top = (startMin / 60) * hourHeight
                            const height = Math.max(((endMin - startMin) / 60) * hourHeight, 20)
                            const colorIdx = getStaffColorIndex(apt.staff_id)
                            const colWidth = 100 / totalColumns
                            const colLeft = column * colWidth

                            return (
                              <div
                                key={apt.id}
                                draggable
                                onDragStart={(e) => {
                                  e.dataTransfer.setData('text/plain', apt.id)
                                  e.dataTransfer.effectAllowed = 'move'
                                  setDraggingId(apt.id)
                                }}
                                onDragEnd={() => setDraggingId(null)}
                                className={cn(
                                  'absolute rounded-md px-1.5 py-0.5 overflow-hidden cursor-grab active:cursor-grabbing hover:opacity-90 transition-opacity border border-white/20',
                                  staffColors[colorIdx],
                                  draggingId === apt.id && 'opacity-50'
                                )}
                                style={{ top, height, left: `${colLeft}%`, width: `${colWidth - 1}%` }}
                                onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt) }}
                              >
                                <p className={cn('text-[10px] font-semibold truncate', staffTextColors[colorIdx])}>
                                  {apt.customers?.name || 'İsimsiz'}
                                </p>
                                {height > 30 && (
                                  <p className={cn('text-[9px] truncate opacity-75', staffTextColors[colorIdx])}>
                                    {apt.services?.name || ''} · {formatTime(apt.start_time)}
                                  </p>
                                )}
                              </div>
                            )
                          })}

                          {/* Şu anki saat çizgisi (sadece bugün) */}
                          {isDayToday && (() => {
                            const currentMin = nowMinutes - startHour * 60
                            if (currentMin < 0 || currentMin > (endHour - startHour + 1) * 60) return null
                            const top = (currentMin / 60) * hourHeight
                            return (
                              <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top }}>
                                <div className="flex items-center">
                                  <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1" />
                                  <div className="flex-1 h-px bg-red-500" />
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })()
      ) : viewMode === 'month' ? (
        /* ── Aylık Takvim Görünümü ── */
        (() => {
          const gridDays = getMonthGridDays(selectedDate)
          const [curY, curM] = selectedDate.split('-').map(Number)
          const dayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
          const staffColors = ['bg-blue-200 dark:bg-blue-800', 'bg-green-200 dark:bg-green-800', 'bg-purple-200 dark:bg-purple-800', 'bg-amber-200 dark:bg-amber-800', 'bg-pink-200 dark:bg-pink-800', 'bg-cyan-200 dark:bg-cyan-800', 'bg-orange-200 dark:bg-orange-800', 'bg-rose-200 dark:bg-rose-800']
          const staffTextColors = ['text-blue-800 dark:text-blue-200', 'text-green-800 dark:text-green-200', 'text-purple-800 dark:text-purple-200', 'text-amber-800 dark:text-amber-200', 'text-pink-800 dark:text-pink-200', 'text-cyan-800 dark:text-cyan-200', 'text-orange-800 dark:text-orange-200', 'text-rose-800 dark:text-rose-200']

          function getStaffColorIndex(sId: string | null): number {
            if (!sId) return 0
            const idx = staffMembers.findIndex(s => s.id === sId)
            return idx >= 0 ? idx % staffColors.length : 0
          }

          const MAX_VISIBLE_PER_DAY = 3

          return (
            <div className="card !p-0 overflow-hidden">
              {/* Gün başlıkları */}
              <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                {dayNames.map((name) => (
                  <div key={name} className="p-2 text-center text-xs font-semibold text-gray-500 dark:text-gray-400">
                    {name}
                  </div>
                ))}
              </div>
              {/* 6 hafta × 7 gün */}
              <div className="grid grid-cols-7 grid-rows-6">
                {gridDays.map((day) => {
                  const [dy, dm, dd] = day.split('-').map(Number)
                  const isOtherMonth = dy !== curY || dm !== curM
                  const isDayToday = day === todayStr
                  const dayApts = appointments
                    .filter(a => a.appointment_date === day)
                    .sort((a, b) => a.start_time.localeCompare(b.start_time))
                  const visible = dayApts.slice(0, MAX_VISIBLE_PER_DAY)
                  const extra = dayApts.length - visible.length

                  return (
                    <div
                      key={day}
                      className={cn(
                        'min-h-[110px] border-b border-r border-gray-100 dark:border-gray-800 p-1.5 flex flex-col gap-1 transition-colors',
                        isOtherMonth && 'bg-gray-50/50 dark:bg-gray-900/30',
                        isDayToday && 'bg-pulse-50/40 dark:bg-pulse-900/20',
                        'hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer'
                      )}
                      onClick={() => {
                        setSelectedDate(day)
                        setViewMode('list')
                      }}
                      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
                      onDrop={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const id = e.dataTransfer.getData('text/plain')
                        if (!id) return
                        handleDragMove(id, day)
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                          isDayToday ? 'bg-pulse-900 text-white' : isOtherMonth ? 'text-gray-400 dark:text-gray-600' : 'text-gray-700 dark:text-gray-300'
                        )}>
                          {dd}
                        </span>
                        {dayApts.length > 0 && (
                          <span className="text-[10px] text-gray-400 tabular-nums">{dayApts.length}</span>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 overflow-hidden">
                        {visible.map((apt) => {
                          const colorIdx = getStaffColorIndex(apt.staff_id)
                          return (
                            <div
                              key={apt.id}
                              draggable
                              onDragStart={(e) => {
                                e.stopPropagation()
                                e.dataTransfer.setData('text/plain', apt.id)
                                e.dataTransfer.effectAllowed = 'move'
                                setDraggingId(apt.id)
                              }}
                              onDragEnd={() => setDraggingId(null)}
                              onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt) }}
                              className={cn(
                                'rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-grab active:cursor-grabbing border border-white/20 hover:opacity-90',
                                staffColors[colorIdx],
                                staffTextColors[colorIdx],
                                draggingId === apt.id && 'opacity-50'
                              )}
                            >
                              {formatTime(apt.start_time)} {apt.customers?.name || 'İsimsiz'}
                            </div>
                          )
                        })}
                        {extra > 0 && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 px-1">
                            +{extra} daha
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()
      ) : null}

      {/* Saat dilimi popup (çakışan randevular) */}
      {slotPopup && (
        <div className="fixed inset-0 z-40" onClick={() => setSlotPopup(null)}>
          <div
            className="absolute z-50 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 w-72 modal-content"
            style={{
              top: typeof window !== 'undefined' ? Math.min(slotPopup.y - 10, window.innerHeight - 300) : slotPopup.y - 10,
              left: typeof window !== 'undefined' ? Math.min(slotPopup.x - 10, window.innerWidth - 300) : slotPopup.x - 10,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                {String(slotPopup.hour).padStart(2, '0')}:00 · {slotPopup.apts.length} randevu
              </h4>
              <button onClick={() => setSlotPopup(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {slotPopup.apts.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => { setSelectedAppointment(apt); setSlotPopup(null) }}
                  className="p-2 rounded-lg bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 cursor-pointer transition-colors"
                >
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{apt.customers?.name || 'İsimsiz'}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {apt.services?.name} · {formatTime(apt.start_time)}–{formatTime(apt.end_time)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {!loading && viewMode !== 'week' && viewMode !== 'month' ? (filteredAppointments.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
            <Calendar className="h-7 w-7 text-gray-300 dark:text-gray-600" />
          </div>
          <p className="mb-1 font-medium text-gray-500 dark:text-gray-400">{search || statusFilter ? 'Filtreye uygun randevu bulunamadı' : 'Bu tarihte randevu yok'}</p>
          {!search && !statusFilter && <button onClick={() => openNewModal()} className="btn-primary mt-4"><Plus className="mr-2 h-4 w-4" />Randevu Ekle</button>}
        </div>
      ) : viewMode === 'list' ? (
        <AnimatedList className="space-y-2">
          {filteredAppointments.map((apt) => {
            const timeState = getTimeState(apt)
            const initials = getInitials(apt.customers?.name || 'İ')
            const avatarColor = getAvatarColor(apt.customers?.name)
            return (
              <AnimatedItem
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  'rounded-2xl border px-4 py-3 transition-all cursor-pointer',
                  'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50',
                  'hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm',
                  timeState === 'past' && 'opacity-60',
                  timeState === 'current' && 'border-green-400 dark:border-green-600 ring-1 ring-green-400 dark:ring-green-600',
                  selectedAppointment?.id === apt.id && 'ring-2 ring-pulse-900 border-pulse-300 dark:border-pulse-700',
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className={cn('flex-shrink-0 flex h-10 w-10 items-center justify-center rounded-xl text-white text-sm font-bold', avatarColor)}>
                    {initials}
                  </div>
                  {/* Time */}
                  <div className="flex flex-col items-center w-14 flex-shrink-0">
                    <span className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatTime(apt.start_time)}</span>
                    <span className="text-[10px] text-gray-400 tabular-nums">{formatTime(apt.end_time)}</span>
                  </div>
                  <div className="w-px h-8 bg-gray-100 dark:bg-gray-800 flex-shrink-0" />
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">{apt.customers?.name || 'İsimsiz'}</span>
                      <span className={`badge text-xs ${getStatusColor(apt.status)}`}>{STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}</span>
                      {apt.recurrence_group_id && <span title="Tekrarlayan randevu"><Repeat className="h-3.5 w-3.5 text-purple-400" /></span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      {apt.services?.name && <span>{apt.services.name}</span>}
                      {apt.staff_members?.name && <><span>·</span><span>{apt.staff_members.name}</span></>}
                      {apt.notes && <><span>·</span><span className="truncate italic">{apt.notes}</span></>}
                    </div>
                  </div>
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <ActionButtons apt={apt} size="md" />
                  </div>
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      ) : (
        <AnimatedList className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {filteredAppointments.map((apt) => {
            const timeState = getTimeState(apt)
            const initials = getInitials(apt.customers?.name || 'İ')
            const avatarColor = getAvatarColor(apt.customers?.name)
            return (
              <AnimatedItem
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  'relative rounded-2xl border p-4 transition-all cursor-pointer hover:shadow-md flex flex-col',
                  'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50',
                  timeState === 'past' && 'opacity-60',
                  timeState === 'current' && 'border-green-400 ring-1 ring-green-400',
                  selectedAppointment?.id === apt.id && 'ring-2 ring-pulse-900',
                )}
              >
                {/* Delete button */}
                {(apt.status === 'no_show' || apt.status === 'cancelled') && (
                  <button
                    onClick={(e) => handleDeleteAppointment(apt.id, e)}
                    title="Sil"
                    className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                {/* Avatar + time */}
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl text-white text-xs font-bold flex-shrink-0', avatarColor)}>
                    {initials}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatTime(apt.start_time)}</p>
                    <p className="text-[10px] text-gray-400 tabular-nums">{formatTime(apt.end_time)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  <span className={`badge text-xs ${getStatusColor(apt.status)}`}>{STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}</span>
                  {apt.recurrence_group_id && <Repeat className="h-3 w-3 text-purple-400" />}
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{apt.customers?.name || 'İsimsiz'}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{apt.services?.name || '—'}</p>
                {apt.staff_members?.name && <p className="text-xs text-gray-400 truncate">{apt.staff_members.name}</p>}
                {apt.services?.price && <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(apt.services.price)}</p>}

                <div className="mt-auto pt-3 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <ActionButtons apt={apt} size="sm" />
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      )) : null}

      {/* ── Detay Slide-Over Paneli ── */}
      {selectedAppointment && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={closePanelAnimated} />
          <div
            className={`slide-panel border-l border-gray-200 dark:border-gray-700 ${panelClosing ? 'closing' : ''}`}
            onAnimationEnd={() => { if (panelClosing) { setSelectedAppointment(null); setPanelClosing(false) } }}
          >
            {/* Panel başlık */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Randevu Detayı</h3>
              <button onClick={closePanelAnimated} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel içerik */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Durum + Saat */}
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatTime(selectedAppointment.start_time)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatTime(selectedAppointment.start_time)} – {formatTime(selectedAppointment.end_time)}</p>
                <div className="flex items-center gap-2">
                  <span className={`badge ${getStatusColor(selectedAppointment.status)}`}>
                    {STATUS_LABELS[selectedAppointment.status as keyof typeof STATUS_LABELS]}
                  </span>
                  {selectedAppointment.recurrence_group_id && (
                    <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      <Repeat className="h-3 w-3 mr-1" />Tekrarlayan
                    </span>
                  )}
                </div>
              </div>

              {/* Bilgiler */}
              <div className="space-y-3">
                <DetailRow label="Müşteri" value={selectedAppointment.customers?.name || 'İsimsiz'} />
                {selectedAppointment.customers?.phone && (
                  <DetailRow label="Telefon" value={
                    <a href={`tel:${selectedAppointment.customers.phone}`} className="text-pulse-900 hover:underline flex items-center gap-1">
                      <Phone className="h-3 w-3" />{selectedAppointment.customers.phone}
                    </a>
                  } />
                )}
                <DetailRow label="Tarih" value={formatDate(selectedAppointment.appointment_date)} />
                {selectedAppointment.services?.name && (
                  <DetailRow label="Hizmet" value={selectedAppointment.services.name} />
                )}
                {selectedAppointment.services?.price && (
                  <DetailRow label="Ücret" value={<span className="text-price">{formatCurrency(selectedAppointment.services.price)}</span>} />
                )}
                {selectedAppointment.staff_members?.name && (
                  <DetailRow label="Personel" value={selectedAppointment.staff_members.name} />
                )}
                {selectedAppointment.notes && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Not</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">{selectedAppointment.notes}</p>
                  </div>
                )}
              </div>

              {/* Aksiyonlar */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'pending') && (
                  <>
                    <button onClick={(e) => { openEditModal(selectedAppointment, e); setSelectedAppointment(null) }} className="btn-secondary w-full justify-start gap-2">
                      <Pencil className="h-4 w-4" /> Düzenle
                    </button>
                    <button onClick={(e) => { openRescheduleModal(selectedAppointment, e); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors">
                      <CalendarClock className="h-4 w-4" /> Ertele
                    </button>
                  </>
                )}
                {selectedAppointment.status === 'completed' && (
                  <button
                    onClick={() => { window.location.href = `/dashboard/kasa?appointmentId=${selectedAppointment.id}` }}
                    className="w-full flex items-center gap-2 rounded-lg border border-pulse-200 dark:border-pulse-800 bg-pulse-50 dark:bg-pulse-900/20 px-4 py-2.5 text-sm font-medium text-pulse-900 dark:text-pulse-300 hover:bg-pulse-100 dark:hover:bg-pulse-800/30 transition-colors"
                  >
                    <CheckCircle className="h-4 w-4" /> Tahsilat Al
                  </button>
                )}
                {selectedAppointment.status === 'confirmed' && (
                  <>
                    <button onClick={async () => { await updateStatus(selectedAppointment.id, 'completed'); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800/30 transition-colors">
                      <CheckCircle className="h-4 w-4" /> Tamamlandı İşaretle
                    </button>
                    <button onClick={async () => { await updateStatus(selectedAppointment.id, 'no_show'); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-800/30 transition-colors">
                      <AlertTriangle className="h-4 w-4" /> Gelmedi İşaretle
                    </button>
                    <button onClick={(e) => { openCancelConfirm(selectedAppointment, e); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors">
                      <XCircle className="h-4 w-4" /> İptal Et
                    </button>
                  </>
                )}
                {selectedAppointment.status === 'pending' && (
                  <button onClick={async () => { await updateStatus(selectedAppointment.id, 'confirmed'); setSelectedAppointment(null) }} className="btn-primary w-full justify-start gap-2">
                    <CheckCircle className="h-4 w-4" /> Onayla
                  </button>
                )}
                {(selectedAppointment.status === 'no_show' || selectedAppointment.status === 'cancelled') && (
                  <>
                    <button onClick={async () => { await updateStatus(selectedAppointment.id, 'confirmed'); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors">
                      <CheckCircle className="h-4 w-4" /> Aktif Et
                    </button>
                    <button onClick={() => handleDeleteAppointment(selectedAppointment.id)} className="w-full flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors">
                      <Trash2 className="h-4 w-4" /> Kalıcı Olarak Sil
                    </button>
                  </>
                )}
                {/* Tekrarlayan seri iptal butonu */}
                {selectedAppointment.recurrence_group_id && (
                  <button
                    onClick={async () => {
                      const ok = await confirm({ title: 'Onay', message: 'Bu serinin gelecekteki tüm randevularını iptal etmek istediğinize emin misiniz?' })
                      if (!ok) return
                      const today = new Date().toISOString().split('T')[0]
                      const { error } = await supabase
                        .from('appointments')
                        .update({ status: 'cancelled' })
                        .eq('recurrence_group_id', selectedAppointment.recurrence_group_id)
                        .gte('appointment_date', today)
                        .in('status', ['pending', 'confirmed'])
                      if (error) { alert('Seri iptal hatası: ' + error.message); return }
                      setSelectedAppointment(null)
                      fetchAppointments()
                    }}
                    className="w-full flex items-center gap-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/30 transition-colors"
                  >
                    <Repeat className="h-4 w-4" /> Tüm Seriyi İptal Et
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Yeni / Düzenleme Randevu Modal */}
      {showModal && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingAppointment ? 'Randevu Düzenle' : 'Yeni Randevu'}
              </h2>
              <button onClick={() => { setShowModal(false); setEditingAppointment(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">Müşteri</label>
                <CustomSelect
                  options={customers.map(c => ({ value: c.id, label: `${c.name} — ${c.phone}` }))}
                  value={customerId}
                  onChange={v => setCustomerId(v)}
                  placeholder="Müşteri seçin..."
                  className="input"
                />
                {customers.length === 0 && <p className="text-xs text-amber-600 mt-1">Önce müşteri eklemelisiniz.</p>}
              </div>
              <div>
                <label className="label">Hizmet</label>
                <CustomSelect
                  options={services.map(s => ({ value: s.id, label: `${s.name} — ${s.duration_minutes} dk${s.price ? ` — ${s.price} TL` : ''}` }))}
                  value={serviceId}
                  onChange={v => setServiceId(v)}
                  placeholder="Hizmet seçin (opsiyonel)..."
                  className="input"
                />
              </div>
              <div>
                <label className="label">Personel</label>
                <CustomSelect
                  options={staffMembers.map(s => ({ value: s.id, label: s.name }))}
                  value={staffId}
                  onChange={v => setStaffId(v)}
                  placeholder="Personel seçin (opsiyonel)..."
                  className="input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tarih</label>
                  <input type="date" value={date} onChange={(e) => {
                    const newDate = e.target.value
                    setDate(newDate)
                    const slots = generateTimeSlots(newDate, workingHours)
                    setStartTime(slots.length > 0 ? slots[0] : '09:00')
                  }} className="input" required />
                </div>
                <div>
                  <label className="label">Saat</label>
                  <CustomSelect
                    options={generateTimeSlots(date, workingHours).map(t => ({ value: t, label: t }))}
                    value={startTime}
                    onChange={v => setStartTime(v)}
                    className="input"
                  />
                  {date && workingHours && generateTimeSlots(date, workingHours).length === 0 && (
                    <p className="text-xs text-red-500 mt-1">Bu gün kapalıdır, randevu oluşturulamaz.</p>
                  )}
                </div>
              </div>
              {serviceId && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />
                  Bitiş: {calculateEndTime(startTime, services.find(s => s.id === serviceId)?.duration_minutes || 30)}
                  {' '}({services.find(s => s.id === serviceId)?.duration_minutes} dk)
                </div>
              )}
              <div>
                <label className="label">Not (opsiyonel)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Ek bilgi..." />
              </div>

              {/* Tekrarlayan Randevu */}
              {!editingAppointment && (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <Repeat className="h-4 w-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Tekrarlayan randevu</span>
                  </label>

                  {isRecurring && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Sıklık</label>
                          <CustomSelect
                            options={[
                              { value: 'weekly', label: 'Her hafta' },
                              { value: 'biweekly', label: 'Her 2 haftada bir' },
                              { value: 'monthly', label: 'Her ay' },
                            ]}
                            value={recurrenceFrequency}
                            onChange={v => setRecurrenceFrequency(v as any)}
                            className="input text-sm"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Seans sayısı</label>
                          <CustomSelect
                            options={[2, 3, 4, 6, 8, 10, 12].map(n => ({ value: String(n), label: `${n} seans` }))}
                            value={String(recurrenceCount)}
                            onChange={v => setRecurrenceCount(Number(v))}
                            className="input text-sm"
                          />
                        </div>
                      </div>
                      {date && (
                        <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 px-3 py-2 text-xs text-purple-700 dark:text-purple-300">
                          <Repeat className="inline h-3 w-3 mr-1" />
                          {getRecurrenceSummary()}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingAppointment(null) }} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving || !customerId} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAppointment ? 'Güncelle' : isRecurring ? `${recurrenceCount} Randevu Oluştur` : 'Randevu Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Erteleme Modal */}
      {rescheduleAppointment && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Randevuyu Ertele</h2>
              <button onClick={() => setRescheduleAppointment(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {rescheduleAppointment.customers?.name} — {formatTime(rescheduleAppointment.start_time)}
            </p>
            <form onSubmit={handleRescheduleSave} className="space-y-4">
              <div>
                <label className="label">Yeni Tarih</label>
                <input type="date" value={rescheduleDate} onChange={(e) => {
                    const newDate = e.target.value
                    setRescheduleDate(newDate)
                    const slots = generateTimeSlots(newDate, workingHours)
                    setRescheduleTime(slots.length > 0 ? slots[0] : '09:00')
                  }} className="input" required />
              </div>
              <div>
                <label className="label">Yeni Saat</label>
                <CustomSelect
                  options={generateTimeSlots(rescheduleDate, workingHours).map(t => ({ value: t, label: t }))}
                  value={rescheduleTime}
                  onChange={v => setRescheduleTime(v)}
                  className="input"
                />
                {rescheduleDate && workingHours && generateTimeSlots(rescheduleDate, workingHours).length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Bu gün kapalıdır, randevu oluşturulamaz.</p>
                )}
              </div>
              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRescheduleAppointment(null)} className="btn-secondary flex-1">Vazgeç</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ertele
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* İptal Onay Modal */}
      {cancelConfirmAppointment && (
        <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Randevuyu İptal Et</h2>
              <button onClick={() => setCancelConfirmAppointment(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {cancelConfirmAppointment.customers?.name} — {formatTime(cancelConfirmAppointment.start_time)} randevusunu iptal etmek istediğinize emin misiniz?
            </p>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={cancelNotifyCustomer} onChange={(e) => setCancelNotifyCustomer(e.target.checked)} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Müşteriye iptal bildirimi gönder</span>
            </label>
            <div className="flex gap-3">
              <button type="button" onClick={() => setCancelConfirmAppointment(null)} className="btn-secondary flex-1">Vazgeç</button>
              <button type="button" onClick={handleCancelConfirm} disabled={saving} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{value}</span>
    </div>
  )
}
