'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { getAppointmentNotesPlaceholder } from '@/lib/config/sector-labels'
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
  Users, User, Building2, Ban, Lock, BellRing, Sparkles, ExternalLink, Package, Wallet, RotateCcw,
} from 'lucide-react'
import { formatTime, formatDate, getStatusColor, formatCurrency, cn, formatDateISO } from '@/lib/utils'
import { STATUS_LABELS, type AppointmentStatus, type Service, type StaffMember, type WorkingHours, type BlockedSlot } from '@/types'
import type { AppointmentRow } from '@/types/db'
import { FollowUpQuickModal } from '@/components/dashboard/follow-up-quick-modal'
import { QuickPaymentModal } from '@/components/dashboard/quick-payment-modal'
import { GalleryTab } from '@/components/customers/gallery-tab'

type AppointmentView = AppointmentRow & {
  customers: { name: string; phone: string | null } | null
  services: { name: string; price: number; duration_minutes: number } | null
  staff_members: { name: string } | null
  campaigns: { name: string } | null
  invoices: { id: string; status: string; paid_amount: number }[] | null
  // Paket seansı bağlantısı (migration 077)
  customer_package_id?: string | null
  package_name?: string | null
  package_unit_price?: number | null
}
import { logAudit } from '@/lib/utils/audit'
import { addMonthsSafe } from '@/lib/utils/date-range'
import { humanizeSupabaseError } from '@/lib/utils/humanize-supabase-error'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useOperation } from '@/lib/hooks/use-operation'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { ToolbarPopover, SortPopoverContent, FilterPopoverList } from '@/components/ui/toolbar-popover'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { Portal } from '@/components/ui/portal'
import EmptyState from '@/components/ui/empty-state'
import ViewModeToggle from '@/components/ui/view-mode-toggle'

const UNRESOLVED_BORDER = 'opacity-50'
const UNRESOLVED_BORDER_ONLY = 'bg-red-50/40 dark:bg-red-950/10 border-red-100 dark:border-red-900/30'

/**
 * Çakışan randevuları yan yana kolonlara dağıtır.
 * Greedy column assignment — aynı saatte birden fazla randevu varsa ekran genişliği
 * eşit paylaşılır, her biri kendi sub-kolonunda görünür ve tıklanabilir kalır.
 *
 * Hem haftalık view (tüm günün randevuları) hem staff/room view'da (kolondaki
 * randevular) kullanılır.
 */
function computeOverlapLayout<T extends { start_time: string; end_time: string }>(
  apts: T[],
): { apt: T; column: number; totalColumns: number }[] {
  if (apts.length === 0) return []
  const sorted = [...apts].sort((a, b) => a.start_time.localeCompare(b.start_time))
  const columns: { endTime: string }[] = []
  const assignments: { apt: T; column: number }[] = []
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
    return {
      apt: assignment.apt,
      column: assignment.column,
      totalColumns: Math.max(...overlapping.map(o => o.column)) + 1,
    }
  })
}

export default function AppointmentsPage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, sector, permissions, writePermissions, loading: ctxLoading } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)
  const { confirm } = useConfirm()
  const { run: runOperation } = useOperation()
  const [appointments, setAppointments] = useState<AppointmentView[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(formatDateISO(new Date()))
  const [now, setNow] = useState<Date | null>(null)
  const [viewMode, setViewMode] = useViewMode('appointments', 'list')
  const [selectedAppointment, setSelectedAppointment] = useState<AppointmentView | null>(null)
  const [panelClosing, setPanelClosing] = useState(false)
  const closePanelAnimated = useCallback(() => setPanelClosing(true), [])
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingAppointment, setEditingAppointment] = useState<AppointmentView | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState<AppointmentView | null>(null)
  const [isClosingReschedule, setIsClosingReschedule] = useState(false)
  const closeReschedule = () => setIsClosingReschedule(true)
  const [cancelConfirmAppointment, setCancelConfirmAppointment] = useState<AppointmentView | null>(null)
  const [isClosingCancelConfirm, setIsClosingCancelConfirm] = useState(false)
  const closeCancelConfirm = () => setIsClosingCancelConfirm(true)
  // Not: Bu state artık kullanılmıyor — iptal sonrası fill-gap her zaman otomatik tetiklenir.
  // Bekleme listesindeki müşteri auto_book_on_match=true ile kayıt olduğu zaman ayrı bir
  // sahip onayına gerek kalmıyor. Hiç eşleşme yoksa fill-gap silent dönüyor.
  const [fillGapLoading, setFillGapLoading] = useState<string | null>(null)
  // Loading state'i hem hangi randevu hem hangi aksiyon — spinner doğru butonda gösterilir
  const [statusLoadingAction, setStatusLoadingAction] = useState<{ id: string; status: AppointmentStatus } | null>(null)
  const isLoading = (id: string, status?: AppointmentStatus) =>
    statusLoadingAction?.id === id && (!status || statusLoadingAction.status === status)

  // M1: supabase istemcisi sabitlenir — her render'da yeni instance üretilmez,
  // useEffect/useCallback bağımlılıklarında stable referans olur.
  const supabase = useMemo(() => createClient(), [])
  const [cancelNotifyCustomer, setCancelNotifyCustomer] = useState(true)
  const [slotPopup, setSlotPopup] = useState<{ day: string; hour: number; apts: AppointmentView[]; x: number; y: number } | null>(null)
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
  // Follow-up modal state
  const [followUpTarget, setFollowUpTarget] = useState<{ appointmentId: string; customerId: string; customerName: string } | null>(null)
  const [quickPaymentTarget, setQuickPaymentTarget] = useState<AppointmentView | null>(null)

  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [staffServicesMap, setStaffServicesMap] = useState<Record<string, string[]>>({}) // staffId → serviceId[]
  const [rooms, setRooms] = useState<{ id: string; name: string; color: string }[]>([])
  const [workingHours, setWorkingHours] = useState<Record<string, { open: string; close: string } | null> | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [roomId, setRoomId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')

  // Tekrarlayan randevu state
  const [isRecurring, setIsRecurring] = useState(false)
  const [recurrenceFrequency, setRecurrenceFrequency] = useState<'weekly' | 'biweekly' | 'monthly'>('weekly')
  const [recurrenceCount, setRecurrenceCount] = useState(4)

  // Önerilen tekrar aralığı uyarısı (services.recommended_interval_days)
  const [intervalWarning, setIntervalWarning] = useState<{
    message: string
    daysRemaining: number
  } | null>(null)

  // Bloklanmış slotlar
  const [blockedSlots, setBlockedSlots] = useState<BlockedSlot[]>([])

  // Rubber-band seçim state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ col: number; hour: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ col: number; hour: number } | null>(null)
  const [selectionViewMode, setSelectionViewMode] = useState<string>('')
  const [actionMenu, setActionMenu] = useState<{ x: number; y: number; cells: { col: number; colId: string; date: string; hour: number }[] } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  const searchParams = useSearchParams()
  const router = useRouter()

  // Bildirimden gelen appointmentId parametresini oku ve detay panelini aç
  useEffect(() => {
    const appointmentId = searchParams.get('appointmentId')
    if (!appointmentId || !businessId || ctxLoading) return

    async function openFromNotification() {
      const { data } = await supabase
        .from('appointments')
        .select('*, customers(name, phone), services(name, duration_minutes, price), staff_members(name), campaigns(name), invoices(id, status, paid_amount)')
        .eq('id', appointmentId!)
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .single()

      if (data) {
        // Randevunun tarihine git
        setSelectedDate(data.appointment_date)
        setSelectedAppointment(data)
      }
      // URL'den parametreyi temizle (geri tuşunda tekrar açılmasın)
      router.replace('/dashboard/appointments', { scroll: false })
    }
    openFromNotification()
  }, [searchParams, businessId, ctxLoading, router, supabase])

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
      .select('*, customers(name, phone), services(name, duration_minutes, price), staff_members(name), campaigns(name), invoices(id, status, paid_amount)')
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
    // getMonthRange/getWeekRange: saf fonksiyonlar, bağımlılık listesine eklenmeleri gerekmez
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, businessId, viewMode, supabase])

  const fetchFormData = useCallback(async () => {
    if (!businessId) return
    const [svcRes, staffRes, stsRes, bizRes, roomsRes] = await Promise.all([
      supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      supabase.from('staff_members').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('staff_services').select('staff_id, service_id').eq('business_id', businessId),
      supabase.from('businesses').select('working_hours').eq('id', businessId).single(),
      fetch(`/api/rooms`).then(r => r.ok ? r.json() : { rooms: [] }).catch(() => ({ rooms: [] })),
    ])
    if (svcRes.data) setServices(svcRes.data)
    if (staffRes.data) setStaffMembers(staffRes.data)
    if (stsRes.data) {
      const map: Record<string, string[]> = {}
      for (const row of stsRes.data) {
        if (!map[row.staff_id]) map[row.staff_id] = []
        map[row.staff_id].push(row.service_id)
      }
      setStaffServicesMap(map)
    }
    if (bizRes.data?.working_hours) setWorkingHours(bizRes.data.working_hours)
    if (roomsRes.rooms) setRooms(roomsRes.rooms)
  }, [businessId, supabase])

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  const fetchBlockedSlots = useCallback(async () => {
    if (!businessId) return
    let from = selectedDate, to = selectedDate
    if (viewMode === 'week') {
      const wr = getWeekRange(selectedDate)
      from = wr.start; to = wr.end
    } else if (viewMode === 'month') {
      const mr = getMonthRange(selectedDate)
      from = mr.start; to = mr.end
    }
    try {
      const res = await fetch(`/api/blocked-slots?businessId=${businessId}&from=${from}&to=${to}`)
      if (res.ok) {
        const data = await res.json()
        setBlockedSlots(data.blockedSlots || [])
      }
    } catch { /* ignore */ }
    // getMonthRange/getWeekRange: saf fonksiyon
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, selectedDate, viewMode])

  useEffect(() => { if (!ctxLoading) fetchAppointments() }, [fetchAppointments, ctxLoading])
  useEffect(() => { if (!ctxLoading) fetchFormData() }, [fetchFormData, ctxLoading])
  useEffect(() => { if (!ctxLoading) fetchBlockedSlots() }, [fetchBlockedSlots, ctxLoading])

  // Realtime: yeni randevu / güncellenme gelince listeyi otomatik tazele
  // H3: aynı zamanda detay paneli açıksa o randevuyu da güncelle (stale veri görünmesin)
  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`appointments-list-${businessId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'appointments',
        filter: `business_id=eq.${businessId}`,
      }, (payload) => {
        fetchAppointments()
        // H3: detay paneli açıksa içindeki randevuyu da güncelle (stale göstermeyi engelle)
        const changed = (payload.new ?? payload.old) as { id?: string } | null
        if (changed?.id) {
          setSelectedAppointment(prev => {
            if (!prev || prev.id !== changed.id) return prev
            // payload.new bazı alanları içermez (sadece değişen sütunlar) — önceki ile birleştir
            const updated = payload.new as Partial<AppointmentView> | null
            return updated ? { ...prev, ...updated } : prev
          })
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [businessId, fetchAppointments, supabase])

  // Müşteri + hizmet seçildiğinde önerilen tekrar aralığı kontrolü
  useEffect(() => {
    if (!showModal || !businessId || !customerId || !serviceId) {
      setIntervalWarning(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/services/interval-check?businessId=${businessId}&customerId=${customerId}&serviceId=${serviceId}`
        )
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        if (data.hasWarning) {
          setIntervalWarning({ message: data.message, daysRemaining: data.daysRemaining })
        } else {
          setIntervalWarning(null)
        }
      } catch {
        // sessiz geç — uyarı kritik değil
      }
    })()
    return () => { cancelled = true }
  }, [showModal, businessId, customerId, serviceId])

  // Tek hiyerarşik ESC handler — önce en üstteki katman kapanır
  useEffect(() => {
    const anyOpen = !!(slotPopup || actionMenu || isSelecting || showModal || rescheduleAppointment || cancelConfirmAppointment || selectedAppointment)
    if (!anyOpen) return
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (slotPopup) { setSlotPopup(null); return }
      if (actionMenu || isSelecting) { clearSelection(); return }
      if (showModal) { setIsClosingModal(true); return }
      // M4: erteleme ve iptal-onay modal'ları ESC ile kapansın
      if (rescheduleAppointment) { closeReschedule(); return }
      if (cancelConfirmAppointment) { setCancelConfirmAppointment(null); return }
      if (selectedAppointment) { closePanelAnimated(); return }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [slotPopup, actionMenu, isSelecting, showModal, rescheduleAppointment, cancelConfirmAppointment, selectedAppointment, closePanelAnimated])

  function changeDate(days: number) {
    let d = new Date(selectedDate + 'T12:00:00')
    if (viewMode === 'month') {
      d = addMonthsSafe(d, days)
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

  function goToday() { setSelectedDate(formatDateISO(new Date())) }

  const effectiveNow = now ?? new Date()
  const todayStr = `${effectiveNow.getFullYear()}-${String(effectiveNow.getMonth() + 1).padStart(2, '0')}-${String(effectiveNow.getDate()).padStart(2, '0')}`
  const isToday = selectedDate === todayStr
  const nowMinutes = now ? now.getHours() * 60 + now.getMinutes() : -1

  // Seçili günün kapalı olup olmadığını hesapla
  const isSelectedDayClosed = useMemo(() => {
    if (!workingHours) return false
    const dayMap: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' }
    const d = new Date(selectedDate + 'T00:00:00')
    const key = dayMap[d.getDay()]
    return workingHours[key] === null || workingHours[key] === undefined
  }, [workingHours, selectedDate])

  function getTimeState(apt: AppointmentView): 'past' | 'current' | 'future' {
    if (selectedDate < todayStr) return 'past'
    if (selectedDate > todayStr) return 'future'
    const toMinutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m }
    const start = toMinutes(apt.start_time)
    const end = toMinutes(apt.end_time)
    if (end <= nowMinutes) return 'past'
    if (start <= nowMinutes && nowMinutes < end) return 'current'
    return 'future'
  }

  // Haftalık/günlük görünümde apt kendi tarihine göre değerlendirilir
  function getAptTimeState(apt: AppointmentView): 'past' | 'current' | 'future' {
    if (apt.appointment_date < todayStr) return 'past'
    if (apt.appointment_date > todayStr) return 'future'
    const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
    const start = toMin(apt.start_time)
    const end = toMin(apt.end_time)
    if (end <= nowMinutes) return 'past'
    if (start <= nowMinutes && nowMinutes < end) return 'current'
    return 'future'
  }

  function getAptVisual(apt: AppointmentView) {
    const ts = getAptTimeState(apt)
    const isDim = apt.status === 'cancelled' || ts === 'past'
    const isActive = ts === 'current' && apt.status !== 'completed' && apt.status !== 'cancelled' && apt.status !== 'no_show'
    const isUnconfirmed = ts === 'future' && apt.status === 'pending'
    return { isActive, isDim, isUnconfirmed }
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

  function openNewModal(overrideDate?: string, overrideTime?: string, overrideEndTime?: string) {
    setEditingAppointment(null)
    setCustomerId(''); setServiceId(''); setStaffId(''); setRoomId('')
    setDate(overrideDate || selectedDate); setStartTime(overrideTime || '09:00'); setEndTime(overrideEndTime || ''); setNotes('')
    setIsRecurring(false); setRecurrenceFrequency('weekly'); setRecurrenceCount(4)
    setError(null); setShowModal(true)
  }

  function openEditModal(apt: AppointmentView, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingAppointment(apt)
    setCustomerId(apt.customer_id); setServiceId(apt.service_id || ''); setStaffId(apt.staff_id || '')
    setRoomId((apt as AppointmentView & { room_id?: string }).room_id || '')
    setDate(apt.appointment_date); setStartTime(apt.start_time); setEndTime(apt.end_time); setNotes(apt.notes || '')
    setIsRecurring(false)
    setError(null); setShowModal(true)
  }

  function openRescheduleModal(apt: AppointmentView, e?: React.MouseEvent) {
    e?.stopPropagation()
    setRescheduleAppointment(apt)
    setRescheduleDate(apt.appointment_date)
    setRescheduleTime(apt.start_time)
    setError(null)
  }

  function openCancelConfirm(apt: AppointmentView, e?: React.MouseEvent) {
    e?.stopPropagation()
    setCancelConfirmAppointment(apt)
    // Geçmiş randevular için bildirim varsayılan KAPALI — saati geçmiş iptale bildirim anlamsız
    const now = new Date()
    const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
    const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const isAptPast = apt.appointment_date < todayISO || (apt.appointment_date === todayISO && apt.start_time <= nowTime)
    setCancelNotifyCustomer(!isAptPast)
  }

  function calculateEndTime(start: string, durationMinutes: number): string {
    const [h, m] = start.split(':').map(Number)
    const totalMin = Math.min(h * 60 + m + durationMinutes, 23 * 60 + 59)
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
    // Randevu çakışması kontrolü
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('business_id', businessId)
      .eq('staff_id', staffIdVal)
      .eq('appointment_date', appointmentDate)
      .in('status', ['pending', 'confirmed'])
    if (existing?.some(apt => {
      if (excludeId && apt.id === excludeId) return false
      return timeRangesOverlap(startTimeVal, endTimeVal, apt.start_time, apt.end_time)
    })) return true
    // M7: bloklu slot kontrolü — personel bazlı veya işletme genelinde bloklar
    const { data: blocks } = await supabase
      .from('blocked_slots')
      .select('start_time, end_time, staff_id')
      .eq('business_id', businessId)
      .eq('date', appointmentDate)
    if (blocks?.some(b =>
      (b.staff_id === null || b.staff_id === staffIdVal) &&
      timeRangesOverlap(startTimeVal, endTimeVal, b.start_time, b.end_time)
    )) return true
    return false
  }

  // C3: çoklu tarih için tek seferde çakışma kontrolü — N+1 sorgu yerine 2 sorgu
  async function checkStaffConflictBatch(
    staffIdVal: string | null, dates: string[],
    startTimeVal: string, endTimeVal: string,
  ): Promise<Set<string>> {
    const conflictDates = new Set<string>()
    if (!staffIdVal || dates.length === 0) return conflictDates
    const [{ data: appts }, { data: blocks }] = await Promise.all([
      supabase
        .from('appointments')
        .select('appointment_date, start_time, end_time')
        .eq('business_id', businessId)
        .eq('staff_id', staffIdVal)
        .in('appointment_date', dates)
        .in('status', ['pending', 'confirmed']),
      supabase
        .from('blocked_slots')
        .select('date, start_time, end_time, staff_id')
        .eq('business_id', businessId)
        .in('date', dates),
    ])
    appts?.forEach(a => {
      if (timeRangesOverlap(startTimeVal, endTimeVal, a.start_time, a.end_time)) {
        conflictDates.add(a.appointment_date)
      }
    })
    blocks?.forEach(b => {
      if ((b.staff_id === null || b.staff_id === staffIdVal) &&
          timeRangesOverlap(startTimeVal, endTimeVal, b.start_time, b.end_time)) {
        conflictDates.add(b.date)
      }
    })
    return conflictDates
  }

  function generateRecurringDates(startDate: string, frequency: string, count: number): string[] {
    const dates: string[] = []
    const [y, m, d] = startDate.split('-').map(Number)
    const baseDate = new Date(y, m - 1, d)
    for (let i = 0; i < count; i++) {
      let dt = new Date(baseDate)
      if (frequency === 'weekly') dt.setDate(baseDate.getDate() + i * 7)
      else if (frequency === 'biweekly') dt.setDate(baseDate.getDate() + i * 14)
      else if (frequency === 'monthly') dt = addMonthsSafe(baseDate, i)
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
    const finalEndTime = endTime || calculateEndTime(startTime, duration)
    const payload = {
      customer_id: customerId, service_id: serviceId || null, staff_id: staffId || null,
      room_id: roomId || null,
      appointment_date: date, start_time: startTime, end_time: finalEndTime, notes: notes || null,
    }
    const conflict = await checkStaffConflict(staffId || null, date, startTime, finalEndTime, editingAppointment?.id ?? null)
    if (conflict) { setError('Bu personelin bu saatte başka bir randevusu var.'); setSaving(false); return }

    if (editingAppointment) {
      const { error } = await supabase.from('appointments').update(payload).eq('id', editingAppointment.id)
      if (error) { setError(humanizeSupabaseError(error)); setSaving(false); return }
    } else if (isRecurring && recurrenceCount > 1) {
      // Tekrarlayan randevu: Toplu oluşturma
      const groupId = crypto.randomUUID()
      const dates = generateRecurringDates(date, recurrenceFrequency, recurrenceCount)

      // C3: çakışma kontrolü tek sorguda (eski hâli her tarih için ayrı sorgu = N+1)
      const conflictSet = await checkStaffConflictBatch(staffId || null, dates, startTime, finalEndTime)
      const conflictDates: string[] = dates.filter(d => conflictSet.has(d))

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
        room_id: roomId || null,
        appointment_date: d,
        start_time: startTime,
        end_time: finalEndTime,
        notes: notes || null,
        status: 'confirmed' as const,
        source: 'manual' as const,
        recurrence_group_id: groupId,
        recurrence_pattern: { frequency: recurrenceFrequency, count: recurrenceCount },
      }))

      const { error } = await supabase.from('appointments').insert(insertPayloads)
      if (error) { setError(humanizeSupabaseError(error)); setSaving(false); return }

      if (conflictDates.length > 0) {
        const skipped = conflictDates.map(d => {
          const [y, m, dd] = d.split('-').map(Number)
          return `${dd}/${m}`
        }).join(', ')
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Kısmi Oluşturma', body: `${validDates.length} randevu oluşturuldu. ${conflictDates.length} tarih çakışma nedeniyle atlandı: ${skipped}` } }))
      }
    } else {
      const { error } = await supabase.from('appointments').insert({ business_id: businessId, ...payload, status: 'confirmed', source: 'manual' })
      if (error) { setError(humanizeSupabaseError(error)); setSaving(false); return }
    }
    const isFirstAppointment = !editingAppointment && appointments.length === 0
    setSaving(false); closeModal()
    await fetchAppointments()
    window.dispatchEvent(new CustomEvent('pulse-toast', {
      detail: isFirstAppointment
        ? { type: 'appointment', title: '🎉 İlk randevunuz oluşturuldu!', body: 'Artık takviminiz canlı.' }
        : { type: 'success', title: editingAppointment ? 'Randevu güncellendi' : 'Randevu oluşturuldu' }
    }))
    const auditCustRes = customerId ? await supabase.from('customers').select('name').eq('id', customerId).single() : null
    const auditCustomer = auditCustRes?.data || null
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

  // ── Rubber-band seçim yardımcıları ──
  function getSelectedCells(
    start: { col: number; hour: number },
    end: { col: number; hour: number },
    colData: { id: string; date: string }[]
  ) {
    const minCol = Math.min(start.col, end.col)
    const maxCol = Math.max(start.col, end.col)
    const minHour = Math.min(start.hour, end.hour)
    const maxHour = Math.max(start.hour, end.hour)
    const cells: { col: number; colId: string; date: string; hour: number }[] = []
    for (let c = minCol; c <= maxCol; c++) {
      for (let h = minHour; h <= maxHour; h++) {
        if (colData[c]) {
          cells.push({ col: c, colId: colData[c].id, date: colData[c].date, hour: h })
        }
      }
    }
    return cells
  }

  function isCellSelected(col: number, hour: number): boolean {
    if (!selectionStart || !selectionEnd || !isSelecting) return false
    const minCol = Math.min(selectionStart.col, selectionEnd.col)
    const maxCol = Math.max(selectionStart.col, selectionEnd.col)
    const minHour = Math.min(selectionStart.hour, selectionEnd.hour)
    const maxHour = Math.max(selectionStart.hour, selectionEnd.hour)
    return col >= minCol && col <= maxCol && hour >= minHour && hour <= maxHour
  }

  function isHourBlocked(date: string, hour: number, staffId?: string | null, roomId?: string | null): boolean {
    return blockedSlots.some(bs => {
      if (bs.date !== date) return false
      const bsStartH = parseInt(bs.start_time.split(':')[0])
      const bsEndH = parseInt(bs.end_time.split(':')[0])
      if (hour < bsStartH || hour >= bsEndH) return false
      if (staffId && bs.staff_id && bs.staff_id !== staffId) return false
      if (roomId && bs.room_id && bs.room_id !== roomId) return false
      if (!staffId && !roomId && !bs.staff_id && !bs.room_id) return true
      if (staffId && bs.staff_id === staffId) return true
      if (roomId && bs.room_id === roomId) return true
      if (!bs.staff_id && !bs.room_id) return true
      return false
    })
  }

  function getBlockedSlotAt(date: string, hour: number, staffId?: string | null, roomId?: string | null): BlockedSlot | null {
    return blockedSlots.find(bs => {
      if (bs.date !== date) return false
      const bsStartH = parseInt(bs.start_time.split(':')[0])
      const bsEndH = parseInt(bs.end_time.split(':')[0])
      if (hour < bsStartH || hour >= bsEndH) return false
      if (staffId && bs.staff_id && bs.staff_id !== staffId) return false
      if (roomId && bs.room_id && bs.room_id !== roomId) return false
      if (!staffId && !roomId && !bs.staff_id && !bs.room_id) return true
      if (staffId && bs.staff_id === staffId) return true
      if (roomId && bs.room_id === roomId) return true
      if (!bs.staff_id && !bs.room_id) return true
      return false
    }) || null
  }

  async function handleBlockSlots(cells: { col: number; colId: string; date: string; hour: number }[], reason?: string) {
    if (!businessId || cells.length === 0) return
    // Günlere göre grupla ve ardışık saatleri birleştir
    const grouped = new Map<string, { date: string; colId: string; hours: number[] }>()
    for (const c of cells) {
      const key = `${c.date}_${c.colId}`
      if (!grouped.has(key)) grouped.set(key, { date: c.date, colId: c.colId, hours: [] })
      grouped.get(key)!.hours.push(c.hour)
    }
    const slots: Array<{ date: string; start_time: string; end_time: string; staff_id?: string; room_id?: string; reason?: string }> = []
    for (const g of grouped.values()) {
      g.hours.sort((a, b) => a - b)
      let rangeStart = g.hours[0]
      let rangeEnd = g.hours[0]
      for (let i = 1; i <= g.hours.length; i++) {
        if (i < g.hours.length && g.hours[i] === rangeEnd + 1) {
          rangeEnd = g.hours[i]
        } else {
          const slot: typeof slots[0] = {
            date: g.date,
            start_time: `${String(rangeStart).padStart(2, '0')}:00`,
            end_time: `${String(rangeEnd + 1).padStart(2, '0')}:00`,
            reason: reason || undefined,
          }
          // viewMode'a göre staff_id/room_id ata
          if (selectionViewMode === 'staff' && g.colId !== '__unassigned__') slot.staff_id = g.colId
          if (selectionViewMode === 'room' && g.colId !== '__unassigned__') slot.room_id = g.colId
          slots.push(slot)
          rangeStart = g.hours[i]
          rangeEnd = g.hours[i]
        }
      }
    }
    try {
      const res = await fetch('/api/blocked-slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, slots }),
      })
      if (res.ok) {
        await fetchBlockedSlots()
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'system', title: 'Saat Bloklandı', body: `${slots.length} zaman dilimi bloklandı.` },
        }))
      }
    } catch { /* ignore */ }
  }

  async function handleUnblock(slotId: string) {
    if (!businessId) return
    try {
      const res = await fetch(`/api/blocked-slots?id=${slotId}&businessId=${businessId}`, { method: 'DELETE' })
      if (res.ok) {
        await fetchBlockedSlots()
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'system', title: 'Blok Kaldırıldı', body: 'Zaman dilimi tekrar açıldı.' },
        }))
      }
    } catch { /* ignore */ }
  }

  // Seçilen hücrelerdeki tüm blokları toplu kaldır
  function computeRemainingIntervals(blockStartH: number, blockEndH: number, selectedHours: Set<number>): { startH: number; endH: number }[] {
    const intervals: { startH: number; endH: number }[] = []
    let rangeStart: number | null = null
    for (let h = blockStartH; h < blockEndH; h++) {
      if (!selectedHours.has(h)) {
        if (rangeStart === null) rangeStart = h
      } else {
        if (rangeStart !== null) {
          intervals.push({ startH: rangeStart, endH: h })
          rangeStart = null
        }
      }
    }
    if (rangeStart !== null) intervals.push({ startH: rangeStart, endH: blockEndH })
    return intervals
  }

  async function handleBulkUnblock(cells: { col: number; colId: string; date: string; hour: number }[]) {
    if (!businessId || cells.length === 0) return

    // Seçili hücreleri date+colId bazında grupla
    const grouped = new Map<string, { date: string; colId: string; hours: Set<number> }>()
    for (const cell of cells) {
      const key = `${cell.date}_${cell.colId}`
      if (!grouped.has(key)) grouped.set(key, { date: cell.date, colId: cell.colId, hours: new Set() })
      grouped.get(key)!.hours.add(cell.hour)
    }

    const toDelete = new Set<string>()
    const toCreate: Array<{ date: string; start_time: string; end_time: string; staff_id?: string; room_id?: string; reason?: string }> = []

    for (const g of grouped.values()) {
      for (const bs of blockedSlots) {
        if (bs.date !== g.date) continue
        if (toDelete.has(bs.id)) continue
        if (selectionViewMode === 'week' && (bs.staff_id || bs.room_id)) continue
        if (selectionViewMode === 'staff' && g.colId !== '__unassigned__' && bs.staff_id && bs.staff_id !== g.colId) continue
        if (selectionViewMode === 'room' && g.colId !== '__unassigned__' && bs.room_id && bs.room_id !== g.colId) continue

        const bsStartH = parseInt(bs.start_time.split(':')[0])
        const bsEndH = parseInt(bs.end_time.split(':')[0])

        // Seçili saatlerle kesişim kontrolü
        let hasOverlap = false
        for (let h = bsStartH; h < bsEndH; h++) {
          if (g.hours.has(h)) { hasOverlap = true; break }
        }
        if (!hasOverlap) continue

        toDelete.add(bs.id)

        // Kalan aralıkları hesapla (split)
        const remaining = computeRemainingIntervals(bsStartH, bsEndH, g.hours)
        for (const r of remaining) {
          toCreate.push({
            date: bs.date,
            start_time: `${String(r.startH).padStart(2, '0')}:00`,
            end_time: `${String(r.endH).padStart(2, '0')}:00`,
            staff_id: bs.staff_id || undefined,
            room_id: bs.room_id || undefined,
            reason: bs.reason || undefined,
          })
        }
      }
    }

    if (toDelete.size === 0) return

    try {
      // Eski blokları sil
      await Promise.all(Array.from(toDelete).map(id =>
        fetch(`/api/blocked-slots?id=${id}&businessId=${businessId}`, { method: 'DELETE' })
      ))
      // Kalan parçaları oluştur
      if (toCreate.length > 0) {
        await fetch('/api/blocked-slots', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ businessId, slots: toCreate }),
        })
      }
      await fetchBlockedSlots()
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'system', title: 'Bloklar Kaldırıldı', body: `${toDelete.size} blok güncellendi.` },
      }))
    } catch { /* ignore */ }
  }

  // Seçilen hücrelerin blok durumunu kontrol et
  function getSelectionBlockStatus(cells: { col: number; colId: string; date: string; hour: number }[]): 'all_blocked' | 'some_blocked' | 'none_blocked' {
    if (cells.length === 0) return 'none_blocked'
    let blockedCount = 0
    for (const cell of cells) {
      const staffArg = selectionViewMode === 'staff' && cell.colId !== '__unassigned__' ? cell.colId : null
      const roomArg = selectionViewMode === 'room' && cell.colId !== '__unassigned__' ? cell.colId : null
      if (isHourBlocked(cell.date, cell.hour, staffArg, roomArg)) blockedCount++
    }
    if (blockedCount === cells.length) return 'all_blocked'
    if (blockedCount > 0) return 'some_blocked'
    return 'none_blocked'
  }

  // Seçimi temizle
  function clearSelection() {
    setIsSelecting(false)
    setSelectionStart(null)
    setSelectionEnd(null)
    setActionMenu(null)
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
    // Eski slot bilgisi (boşalan yer) — fill-gap için yakala
    const freedSlot = {
      date: rescheduleAppointment.appointment_date,
      time: rescheduleAppointment.start_time,
      endTime: rescheduleAppointment.end_time,
      staffId: rescheduleAppointment.staff_id,
      serviceId: rescheduleAppointment.service_id,
    }
    const aptId = rescheduleAppointment.id
    const { error } = await supabase.from('appointments').update({ appointment_date: rescheduleDate, start_time: rescheduleTime, end_time: endTime }).eq('id', aptId)
    if (error) { setError(humanizeSupabaseError(error)); setSaving(false); return }
    setSaving(false); closeReschedule(); fetchAppointments()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Randevu ertelendi' } }))
    // Eski slot için bekleme listesi otomatik kontrol — silent (eşleşme yoksa toast yok)
    setTimeout(() => handleFillGap(aptId, undefined, { silent: true, freedSlot, trigger: 'reschedule' }), 300)
  }

  async function handleCancelConfirm() {
    if (!cancelConfirmAppointment) return
    setSaving(true)
    const apt = cancelConfirmAppointment
    const { error } = await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', apt.id)
    if (error) { window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'İptal güncellenemedi', body: humanizeSupabaseError(error) } })); setSaving(false); closeCancelConfirm(); return }
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
        body: `${apt.customers?.name || customerLabel} — ${apt.services?.name || ''} — ${apt.appointment_date} ${apt.start_time}`,
        is_read: false,
      })
    } catch { /* */ }
    setSaving(false); closeCancelConfirm()
    // Slide-over panel açık kalsın — kullanıcı iptal sonrası geri almak veya
    // başka aksiyon (Aktif Et/Sil) yapmak isteyebilir; status badge'ini canlı
    // tutmak için seçili randevuyu güncelle
    if (selectedAppointment?.id === apt.id) {
      setSelectedAppointment(prev => prev ? { ...prev, status: 'cancelled' } : null)
    }
    fetchAppointments()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Randevu iptal edildi' } }))
    // Otomatik bekleme listesi kontrolü — eşleşme yoksa sessiz geç (toast atma)
    setTimeout(() => handleFillGap(apt.id, undefined, { silent: true }), 300)
  }

  async function handleFillGap(
    appointmentId: string,
    e?: React.MouseEvent,
    opts?: {
      silent?: boolean
      // Erteleme/silme akışında: eski slot bilgisi body'ye geçilir,
      // çünkü appointment artık ya farklı slot'ta ya da deleted.
      freedSlot?: {
        date: string
        time: string
        endTime: string
        staffId: string | null
        serviceId: string | null
      }
      trigger?: 'cancel' | 'reschedule' | 'delete'
    },
  ) {
    e?.stopPropagation()
    const silent = !!opts?.silent
    setFillGapLoading(appointmentId)
    try {
      const body = opts?.freedSlot
        ? JSON.stringify({ freedSlot: opts.freedSlot, trigger: opts.trigger ?? 'reschedule' })
        : undefined
      const res = await fetch(`/api/appointments/${appointmentId}/fill-gap`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      const j = await res.json()
      if (!res.ok) {
        if (!silent) window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: j.error || 'Bildirim gönderilemedi' } }))
      } else if (j.notified === 0) {
        // Hiç eşleşme yok — silent modda toast atlanır (otomatik tetikleme için)
        if (!silent) window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'appointment', title: 'Uygun müşteri bulunamadı', body: 'Bekleme listesinde veya geçmişte uygun müşteri yok.' } }))
      } else if (j.autoBooked) {
        // Otomatik randevu oluşturuldu — silent olsa bile bilgi ver
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'appointment', title: 'Otomatik Randevu', body: 'Bekleme listesinden bu boşluk otomatik dolduruldu.' } }))
        fetchAppointments()
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'appointment', title: 'Bildirimler Gönderildi', body: `${j.notified} kişiye boşluk bildirimi gönderildi.` } }))
      }
    } catch {
      if (!silent) window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Bağlantı hatası' } }))
    }
    finally { setFillGapLoading(null) }
  }

  async function handleDeleteAppointment(appointmentId: string, e?: React.MouseEvent) {
    e?.stopPropagation()
    const ok = await confirm({ title: 'Onay', message: 'Bu randevuyu kalıcı olarak silmek istediğinizden emin misiniz?' })
    if (!ok) return
    // Slot bilgisini silmeden önce yakala (fill-gap için)
    const aptToDelete = appointments.find(a => a.id === appointmentId)
    const freedSlot = aptToDelete ? {
      date: aptToDelete.appointment_date,
      time: aptToDelete.start_time,
      endTime: aptToDelete.end_time,
      staffId: aptToDelete.staff_id,
      serviceId: aptToDelete.service_id,
    } : null
    const { error } = await supabase
      .from('appointments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', appointmentId)
    if (error) { window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Silme hatası: ' + error.message } })); return }
    // Silinen slot için bekleme listesi otomatik kontrol — silent (eşleşme yoksa toast yok)
    if (freedSlot) {
      setTimeout(() => handleFillGap(appointmentId, undefined, { silent: true, freedSlot, trigger: 'delete' }), 300)
    }
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
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Randevu silindi' } }))
  }

  async function updateStatus(appointmentId: string, newStatus: AppointmentStatus, e?: React.MouseEvent) {
    e?.stopPropagation()

    // 'Tamamlandı' işareti için veri bütünlüğü guard'ı:
    // service_id null olan randevular bekleme listesi hold'undan veya eksik
    // veriden gelmiş olabilir → tamamlandı işaretlemek tahsilat/sadakat tetikleyicilerini
    // bozar. Kullanıcıya onay sor, yanlışlıkla işaretlemeyi engelle.
    if (newStatus === 'completed') {
      const apt = appointments.find(a => a.id === appointmentId)
      if (apt && !apt.service_id) {
        const proceed = await confirm({
          title: 'Hizmet Seçilmemiş',
          message:
            'Bu randevuda hizmet seçilmemiş. Tamamlandı işaretlersen tahsilat ve sadakat takibi düzgün çalışmaz.\n\n' +
            'Önce randevuyu düzenleyip hizmet seçmen önerilir. Yine de devam etmek istiyor musun?',
          confirmText: 'Yine de İşaretle',
          cancelText: 'Vazgeç',
          variant: 'warning',
        })
        if (!proceed) return
      }
    }

    // 'Gelmedi' işareti — geri alınamaz + workflow tetikliyor (SMS olabilir),
    // yanlışlıkla tıklamayı engellemek için onay sor.
    if (newStatus === 'no_show') {
      const proceed = await confirm({
        title: 'Gelmedi İşaretle',
        message: 'Müşteri randevuya gelmedi olarak işaretlenecek. Otomatik mesaj akışları varsa müşteriye bildirim gidebilir. Devam edelim mi?',
        confirmText: 'Evet, İşaretle',
        cancelText: 'Vazgeç',
        variant: 'warning',
      })
      if (!proceed) return
    }

    setStatusLoadingAction({ id: appointmentId, status: newStatus })

    // pending → success/error akışı için merkezi mesajlar
    const pendingLabels: Record<string, string> = {
      completed: 'Tamamlandı işaretleniyor...',
      cancelled: 'İptal ediliyor...',
      no_show: 'Gelmedi işaretleniyor...',
      confirmed: 'Onaylanıyor...',
      pending: 'Beklemeye alınıyor...',
    }
    const successLabels: Record<string, string> = {
      completed: 'Tamamlandı',
      cancelled: 'İptal edildi',
      no_show: 'Gelmedi olarak işaretlendi',
      confirmed: 'Onaylandı',
      pending: 'Beklemede',
    }

    const result = await runOperation(
      async () => {
        const { error } = await supabase.from('appointments').update({ status: newStatus }).eq('id', appointmentId)
        if (error) {
          if (error.message.includes('segment') && error.message.includes('customer_segment')) {
            throw new Error('Veritabanı ayarı eksik — Supabase\'de 003_fix_appointment_customer_segment.sql migration\'ını çalıştırın.')
          }
          throw error
        }
        return true
      },
      {
        pending: pendingLabels[newStatus] || 'Güncelleniyor...',
        success: successLabels[newStatus] || 'Durum güncellendi',
        error: 'Durum güncellenemedi',
      },
    )

    if (!result) {
      setStatusLoadingAction(null)
      return
    }
    // Detay panelindeki randevuyu güncelle
    if (selectedAppointment?.id === appointmentId) {
      setSelectedAppointment((prev) => prev ? { ...prev, status: newStatus } : null)
    }
    const statusApt = appointments.find(a => a.id === appointmentId)

    // Not: Randevu tamamlandığında takip modal'ı OTOMATİK açılmaz.
    // Otomatik mesaj akışları (workflow) zaten gerekli mesajları gönderiyor.
    // Personel özel/kişiye özel takip ihtiyacı duyarsa randevu detay
    // panelindeki "Takip Başlat" butonundan veya /dashboard/follow-ups
    // sayfasından manuel başlatabilir. Bu sayede workflow ile çakışma
    // riski azalır + her tamamlanan randevuda gereksiz modal açılmaz.

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
    // Randevu tamamlandığında: paket seansı düşümü + sadakat puanı ekleme
    if (newStatus === 'completed' && statusApt) {
      // C2: Paket seansı düşümü ATOMIC — RPC ile race condition'a karşı korunur.
      // Eski kod: SELECT → newUsed = used+1 → UPDATE açığı vardı; iki sekme aynı anda
      // tıklarsa ikisi de aynı sessions_used değerini okur, ikisi de +1 yazar.
      if (statusApt.customer_package_id && businessId) {
        const { data: rpcResult } = await supabase.rpc('increment_package_session', {
          p_package_id: statusApt.customer_package_id,
          p_business_id: businessId,
        })
        const pkgRow = Array.isArray(rpcResult) ? rpcResult[0] : rpcResult
        if (pkgRow && !pkgRow.was_already_full) {
          // Rezervasyon kaydı zaten var (portal booking) — yoksa oluştur (staff-created)
          const { data: existingUsage } = await supabase
            .from('package_usages')
            .select('id')
            .eq('appointment_id', appointmentId)
            .maybeSingle()
          if (!existingUsage) {
            await supabase.from('package_usages').insert({
              business_id: businessId,
              customer_package_id: statusApt.customer_package_id,
              appointment_id: appointmentId,
              staff_id: currentStaffId || null,
              used_at: new Date().toISOString(),
              notes: 'Randevu tamamlandı',
            })
          }
        }
      }

      // NOT: Sadakat puanı artık randevu tamamlandığında değil, TAHSİLAT alındığında eklenir.
      // Tetikleyiciler: /api/invoices/payments (paid geçişi) + /api/pos (paid status).
      // Tahsilatsız tamamlanan randevular için puan eklenmez — gerçek müşteri davranışına uygun.
    }

    // İş akışı tetikleyicileri
    if (['completed', 'cancelled', 'no_show'].includes(newStatus) && statusApt?.customer_id) {
      const triggerMap: Record<string, string> = {
        completed: 'appointment_completed',
        cancelled: 'appointment_cancelled',
        no_show: 'no_show',
      }
      try {
        await fetch('/api/workflows/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            triggerType: triggerMap[newStatus],
            customerId: statusApt.customer_id,
            appointmentId,
          }),
        })
      } catch { /* workflow tetikleme hatası ana akışı durdurmasın */ }
    }

    await fetchAppointments()
    // Başarı toast'u zaten runOperation içinde dispatch edildi
    setStatusLoadingAction(null)
  }

  async function handleRevertCompleted(appointmentId: string) {
    const apt = appointments.find(a => a.id === appointmentId) ?? selectedAppointment
    if (!apt) return

    // Çift-tık koruması — randevu zaten 'completed' değilse erken çık.
    // Hızlı art arda tıklamada paket sessions_used iki kez azaltılırdı.
    if (apt.status !== 'completed') {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'İşlem yapılamaz', body: 'Randevu zaten tamamlandı durumunda değil.' },
      }))
      return
    }

    // Randevuya bağlı tahsilat (fatura) var mı? Varsa kullanıcıya iade seçeneği sun.
    let paidInvoice: { id: string; paid_amount: number; total: number } | null = null
    {
      const { data: inv } = await supabase
        .from('invoices')
        .select('id, paid_amount, total, status')
        .eq('appointment_id', appointmentId)
        .eq('business_id', businessId!)
        .is('deleted_at', null)
        .gt('paid_amount', 0)
        .maybeSingle()
      if (inv) paidInvoice = { id: inv.id, paid_amount: Number(inv.paid_amount), total: Number(inv.total) }
    }

    let confirmMessage =
      'Randevu "Onaylandı" durumuna geri alınacak.\n\n' +
      '• Paket seansıysa kullanılan seans 1 azaltılır.\n' +
      '• Verilen sadakat puanı geri alınır.\n' +
      '• Müşteriye bildirim GİTMEZ — sessiz işlem.\n\n' +
      'Not: Tamamlandığında otomatik gönderilen mesajlar (yorum isteği vb.) varsa geri çekilemez.'

    let refundDecision: 'refund' | 'keep' | null = null
    if (paidInvoice) {
      // İlk soru: iade et mi, yoksa para kalsın mı?
      const refundOk = await confirm({
        title: 'Bu randevunun ödemesi alınmış',
        message: `${paidInvoice.paid_amount.toFixed(2)}₺ iade edilsin mi?`,
        confirmText: 'Evet, İade Et',
        cancelText: 'Sadece Durumu Geri Al',
        variant: 'warning',
      })
      if (refundOk === null) return  // X'e basıldı — tüm işlemi iptal et
      refundDecision = refundOk ? 'refund' : 'keep'
      // Status revert kullanıcı isteğine bağlı — iade yoksa hâlâ status'u geri almak isteyebilir,
      // bu yüzden ikinci bir onay sormaya gerek yok; doğrudan revert akışına devam.
      confirmMessage = refundDecision === 'refund'
        ? `Tahsilat ${paidInvoice.paid_amount.toFixed(2)}₺ iade edilecek + durum "Onaylandı" yapılacak. Onaylıyor musun?`
        : 'Durum "Onaylandı" yapılacak, tahsilat olduğu gibi kalacak. Onaylıyor musun?'
    }

    const ok = await confirm({
      title: 'Tamamlandı Durumunu Geri Al',
      message: confirmMessage,
      confirmText: 'Geri Al',
      cancelText: 'Vazgeç',
      variant: 'warning',
    })
    if (!ok) return

    // C1: Server endpoint — atomik akış (status update → refund → package → loyalty)
    // Hata olursa server status'u rollback eder, kısmi başarı durumu olmaz.
    const result = await runOperation(
      async () => {
        const res = await fetch(`/api/appointments/${appointmentId}/revert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refund: refundDecision === 'refund' }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json.error || 'İşlem başarısız')
        return json as { ok: true; pointsReverted: number; loyaltyWarning: string | null; refunded: boolean }
      },
      {
        pending: 'Durum geri alınıyor...',
        success: refundDecision === 'refund' && paidInvoice
          ? `Geri alındı + ${paidInvoice.paid_amount.toFixed(2)}₺ iade kaydedildi`
          : refundDecision === 'keep'
            ? 'Geri alındı (tahsilat duruyor)'
            : 'Durum geri alındı',
        error: 'Geri alma başarısız',
      },
    )
    if (!result) return

    // Detay panelini anında güncelle (realtime de tetikleyecek ama hızlı UX için)
    if (selectedAppointment?.id === appointmentId) {
      setSelectedAppointment(prev => prev ? { ...prev, status: 'confirmed' } : null)
    }
    fetchAppointments()

    // Harcanmış puan uyarısı — varsa ayrıca göster
    if (result.loyaltyWarning) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Sadakat Puanı Geri Alınamadı', body: result.loyaltyWarning },
      }))
    }
  }

  function getDayKeyFromDate(dateStr: string): keyof WorkingHours {
    const dayMap: Record<number, keyof WorkingHours> = {
      0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat'
    }
    const d = new Date(dateStr + 'T00:00:00')
    return dayMap[d.getDay()]
  }

  function generateTimeSlots(dateStr?: string, wh?: Record<string, { open: string; close: string } | null> | null, includeClose?: boolean): string[] {
    let slots: string[] = []
    if (dateStr && wh) {
      const dayKey = getDayKeyFromDate(dateStr)
      const dayHours = wh[dayKey]
      if (!dayHours) return [] // kapalı gün
      const [openH, openM] = dayHours.open.split(':').map(Number)
      const [closeH, closeM] = dayHours.close.split(':').map(Number)
      const openTotal = openH * 60 + openM
      const closeTotal = closeH * 60 + closeM
      for (let t = openTotal; t < closeTotal; t += 30) {
        const hh = Math.floor(t / 60)
        const mm = t % 60
        slots.push(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)
      }
      // Bitiş saati için kapanış saatini de ekle
      if (includeClose) {
        const closeStr = `${String(closeH).padStart(2, '0')}:${String(closeM).padStart(2, '0')}`
        if (!slots.includes(closeStr)) slots.push(closeStr)
      }
    } else {
      // Fallback: 08:00 - 21:30
      for (let h = 8; h <= 21; h++) {
        slots.push(`${String(h).padStart(2, '0')}:00`)
        slots.push(`${String(h).padStart(2, '0')}:30`)
      }
    }
    // Bloklanmış saatleri işaretle (kaldırmak yerine label'da göster)
    if (dateStr) {
      const blockedForDate = blockedSlots.filter(bs => bs.date === dateStr && !bs.staff_id && !bs.room_id)
      if (blockedForDate.length > 0) {
        slots = slots.filter(slot => {
          const slotMin = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1])
          return !blockedForDate.some(bs => {
            const bsStart = parseInt(bs.start_time.split(':')[0]) * 60 + parseInt(bs.start_time.split(':')[1])
            const bsEnd = parseInt(bs.end_time.split(':')[0]) * 60 + parseInt(bs.end_time.split(':')[1])
            return slotMin >= bsStart && slotMin < bsEnd
          })
        })
      }
    }
    return slots
  }

  // Dikkat gerektiren randevular: (1) geçmiş + sonuçlanmamış, (2) tamamlandı ama tahsilat yok
  const { unresolvedIds, unresolvedCount, pastIds } = useMemo(() => {
    const n = new Date()
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`
    const nowMin = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`
    const ids = new Set<string>()
    const pids = new Set<string>()
    for (const a of appointments) {
      const isInPast = a.appointment_date < today || (a.appointment_date === today && a.end_time <= nowMin)
      if (isInPast) pids.add(a.id)
      if (a.status === 'cancelled' || a.status === 'no_show') continue
      if (a.status === 'completed') {
        // Tamamlandı ama ödeme alınmamışsa dikkat gerekiyor.
        // Paket seansı: ödeme paket satışında alındı — fatura beklenmez, kırmızı gösterme.
        const isPackageSession = !!(a as AppointmentView).customer_package_id
        const invs = Array.isArray(a.invoices) ? a.invoices : []
        const hasPaid = isPackageSession || invs.some(i => i.status === 'paid' || (i.paid_amount ?? 0) > 0)
        if (!hasPaid) {
          // Üç senaryo:
          // 1) hizmet seçilmemiş (service_id null) → veri eksikliği, KIRMIZI (yanlışlıkla tamamlandı işaretlendi)
          // 2) hizmet var, fiyat > 0, ödeme yok → KIRMIZI (tahsilat alınmamış)
          // 3) hizmet var, fiyat == 0 → ücretsiz konsültasyon vb. → kırmızı YOK
          const hasService = !!a.service_id
          const svcPrice = a.services?.price ?? null
          if (!hasService || (svcPrice != null && svcPrice > 0)) {
            ids.add(a.id)
          }
        }
        continue
      }
      // Geçmişteki ama sonuçlandırılmamış randevular
      if (isInPast) ids.add(a.id)
    }
    return { unresolvedIds: ids, unresolvedCount: ids.size, pastIds: pids }
  }, [appointments])
  const isPastUnresolved = (apt: AppointmentView) => unresolvedIds.has(apt.id)
  const isPast = (apt: AppointmentView) => pastIds.has(apt.id)

  const totalCount = appointments.length
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length
  const completedCount = appointments.filter(a => a.status === 'completed').length
  const noShowCount = appointments.filter(a => a.status === 'no_show').length

  // H5: tüm aktif filtreleri (durum + arama dahil) say — toolbar ikonu doğru highlight alır
  const hasActiveFilters = !!(staffIdFilter || serviceIdFilter || statusFilter || search.trim())
  const filteredAppointments = (() => {
    let list = appointments.filter(a => {
      if (statusFilter === 'unresolved') {
        if (!isPastUnresolved(a)) return false
      } else if (statusFilter && a.status !== statusFilter) return false
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
        let va: string | number | null | undefined
        let vb: string | number | null | undefined
        if (sortField === 'customer_name') { va = a.customers?.name; vb = b.customers?.name }
        else if (sortField === 'service_name') { va = a.services?.name; vb = b.services?.name }
        else {
          va = a[sortField as keyof AppointmentView] as string | number | null | undefined
          vb = b[sortField as keyof AppointmentView] as string | number | null | undefined
        }
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp =
          typeof va === 'string' && typeof vb === 'string'
            ? va.localeCompare(vb, 'tr')
            : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    }
    return list
  })()

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Randevular</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{totalCount} randevu</p>
        </div>
        <button onClick={() => openNewModal()} className="btn-primary shrink-0">
          <Plus className="mr-2 h-4 w-4" />Yeni Randevu
        </button>
      </div>

      {/* Tarih Navigasyonu */}
      <div className="flex items-center rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
        <button onClick={() => changeDate(-1)} aria-label="Önceki" className="flex h-11 w-11 flex-shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0 flex items-center justify-center gap-3 px-3">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate tabular-nums">
            {viewMode === 'week' ? formatWeekRange() :
             viewMode === 'month' ? formatMonthLabel() :
             viewMode === 'staff' ? `${formatSelectedDate()} — Personel` :
             viewMode === 'room' ? `${formatSelectedDate()} — Odalar` :
             formatSelectedDate()}
          </p>
          {(viewMode === 'week' || viewMode === 'month' || !isToday) && (
            <button
              onClick={goToday}
              className="text-xs font-medium text-pulse-900 dark:text-pulse-400 hover:underline whitespace-nowrap"
            >
              {viewMode === 'week' ? 'Bu hafta' :
               viewMode === 'month' ? 'Bu ay' :
               'Bugün'}
            </button>
          )}
        </div>
        <button onClick={() => changeDate(1)} aria-label="Sonraki" className="flex h-11 w-11 flex-shrink-0 items-center justify-center text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Durum chip'leri + Görünüm & Filtre araçları */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        {/* Durum filtre chip'leri — kompakt, tek satır */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusChip label="Onaylı" count={confirmedCount} active={statusFilter === 'confirmed'} tone="info" onClick={() => setStatusFilter(statusFilter === 'confirmed' ? null : 'confirmed')} />
          <StatusChip label="Tamamlandı" count={completedCount} active={statusFilter === 'completed'} tone="success" onClick={() => setStatusFilter(statusFilter === 'completed' ? null : 'completed')} />
          <StatusChip label="Gelmedi" count={noShowCount} active={statusFilter === 'no_show'} tone="danger" onClick={() => setStatusFilter(statusFilter === 'no_show' ? null : 'no_show')} />
          <StatusChip label="Sonuçlanmamış" count={unresolvedCount} active={statusFilter === 'unresolved'} tone="warning" onClick={() => setStatusFilter(statusFilter === 'unresolved' ? null : 'unresolved')} />
          {statusFilter && (
            <button
              onClick={() => setStatusFilter(null)}
              className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-2 py-1"
            >
              <X className="h-3 w-3" /> Temizle
            </button>
          )}
        </div>

        {/* Sağ: Filtre / Sıralama / Görünüm */}
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
                  { value: 'customer_name', label: `${customerLabel} adı` },
                  { value: 'service_name', label: 'Hizmet' },
                ]}
                sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir}
              />
            </ToolbarPopover>
            <ViewModeToggle
              value={viewMode}
              onChange={setViewMode}
              modes={[
                { key: 'list' as const, icon: <LayoutList className="h-4 w-4" />, label: 'Liste' },
                { key: 'week' as const, icon: <CalendarDays className="h-4 w-4" />, label: 'Haftalık Takvim' },
                { key: 'month' as const, icon: <CalendarRange className="h-4 w-4" />, label: 'Aylık Takvim' },
                { key: 'box' as const, icon: <LayoutGrid className="h-4 w-4" />, label: 'Kutu Görünüm' },
                { key: 'staff' as const, icon: <Users className="h-4 w-4" />, label: 'Personel Takvimi' },
                { key: 'room' as const, icon: <Building2 className="h-4 w-4" />, label: 'Oda Takvimi' },
              ]}
            />
          </div>
        </div>
      </div>

      {/* Arama (liste/kutu modunda) */}
      {viewMode !== 'week' && viewMode !== 'month' && viewMode !== 'staff' && viewMode !== 'room' && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} className="input pl-10" placeholder={`${customerLabel}, hizmet veya personel ara...`} />
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

          // computeOverlapLayout artık dosya üst seviyesinde — tüm view'lar paylaşır

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
                      const dayAppointments = filteredAppointments.filter(a => a.appointment_date === day)
                      const isDayToday = day === todayStr
                      const isDayPast = day < todayStr
                      const nowTimeStr = now
                        ? `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
                        : '23:59'
                      const weekColData = weekDays.map(d => ({ id: d, date: d }))

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
                          onMouseDown={(e) => {
                            if (e.button !== 0) return
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            const hour = Math.max(startHour, Math.min(endHour, Math.floor((e.clientY - rect.top) / hourHeight) + startHour))
                            setSelectionStart({ col: dayIdx, hour })
                            setSelectionEnd({ col: dayIdx, hour })
                            setIsSelecting(true)
                            setSelectionViewMode('week')
                            setActionMenu(null)
                            e.preventDefault()
                          }}
                          onMouseMove={(e) => {
                            if (!isSelecting || selectionViewMode !== 'week') return
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                            const hour = Math.max(startHour, Math.min(endHour, Math.floor((e.clientY - rect.top) / hourHeight) + startHour))
                            setSelectionEnd({ col: dayIdx, hour })
                          }}
                          onMouseUp={(e) => {
                            if (!isSelecting || selectionViewMode !== 'week' || !selectionStart || !selectionEnd) return
                            setIsSelecting(false)
                            const cells = getSelectedCells(selectionStart, selectionEnd, weekColData)
                            if (cells.length <= 1 && selectionStart.col === selectionEnd.col && selectionStart.hour === selectionEnd.hour) {
                              const blocked = getBlockedSlotAt(day, selectionStart.hour)
                              if (blocked) {
                                handleUnblock(blocked.id)
                                clearSelection()
                                return
                              }
                              // Tek tıklama — randevu popup veya yeni randevu
                              const timeStr = `${String(selectionStart.hour).padStart(2, '0')}:00`
                              if (dayAppointments.length > 0) {
                                const hourApts = dayAppointments.filter(a => parseInt(a.start_time.split(':')[0]) === selectionStart!.hour)
                                if (hourApts.length > 0) {
                                  setSlotPopup({ day, hour: selectionStart.hour, apts: hourApts, x: e.clientX, y: e.clientY })
                                  clearSelection()
                                  return
                                }
                              }
                              openNewModal(day, timeStr)
                              clearSelection()
                              return
                            }
                            setActionMenu({ x: e.clientX, y: e.clientY, cells })
                          }}
                        >
                          {/* Bloklanmış saatler */}
                          {hours.map(hour => {
                            const blocked = isHourBlocked(day, hour)
                            if (!blocked) return null
                            return (
                              <div
                                key={`blocked-${hour}`}
                                className="absolute left-0 right-0 bg-gray-200/60 dark:bg-gray-700/60 border-y border-gray-300/50 dark:border-gray-600/50"
                                style={{ top: (hour - startHour) * hourHeight, height: hourHeight }}
                              >
                                <div className="flex items-center justify-center h-full opacity-40">
                                  <Ban className="h-3 w-3 text-gray-500 dark:text-gray-400" />
                                </div>
                              </div>
                            )
                          })}
                          {/* Seçim highlight */}
                          {(isSelecting || actionMenu) && selectionViewMode === 'week' && hours.map(hour => {
                            if (!isCellSelected(dayIdx, hour)) return null
                            return (
                              <div
                                key={`sel-${hour}`}
                                className="absolute left-0 right-0 bg-pulse-900/20 dark:bg-pulse-400/20 border border-pulse-900/30 dark:border-pulse-400/30 pointer-events-none z-[5]"
                                style={{ top: (hour - startHour) * hourHeight, height: hourHeight }}
                              />
                            )
                          })}
                          {/* Randevu blokları — 3+ çakışmada tek blok göster */}
                          {(() => {
                            const layout = computeOverlapLayout(dayAppointments)
                            // 3+ çakışan grupları bul
                            const mergedGroups = new Map<string, typeof layout>()
                            for (const item of layout) {
                              if (item.totalColumns >= 3) {
                                const overlapping = layout.filter(o =>
                                  o.totalColumns >= 3 &&
                                  o.apt.start_time < item.apt.end_time &&
                                  o.apt.end_time > item.apt.start_time
                                )
                                const key = overlapping.map(o => o.apt.id).sort().join(',')
                                if (!mergedGroups.has(key)) mergedGroups.set(key, overlapping)
                              }
                            }
                            const mergedIds = new Set<string>()
                            mergedGroups.forEach(items => items.forEach(i => mergedIds.add(i.apt.id)))

                            return (
                              <>
                                {/* Birleştirilmiş bloklar */}
                                {Array.from(mergedGroups.values()).map((items) => {
                                  const apts = items.map(i => i.apt)
                                  const earliest = Math.min(...apts.map(a => toMinutes(a.start_time)))
                                  const latest = Math.max(...apts.map(a => toMinutes(a.end_time)))
                                  const topPos = ((earliest - startHour * 60) / 60) * hourHeight
                                  const h = Math.max(((latest - earliest) / 60) * hourHeight, 28)
                                  const colorIdx = getStaffColorIndex(apts[0].staff_id)
                                  const mergedIsPast = isDayPast || (isDayToday && apts.every(a => a.end_time <= nowTimeStr))
                                  return (
                                    <div
                                      key={`mg-${apts[0].id}`}
                                      className={cn(
                                        'absolute left-0 right-0 rounded-md px-2 py-1 cursor-pointer hover:opacity-90 transition-opacity border border-white/20 flex items-center justify-center',
                                        staffColors[colorIdx]
                                      )}
                                      style={{ top: topPos, height: h, opacity: mergedIsPast ? 0.5 : 1 }}
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onMouseUp={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        const hour = Math.floor(earliest / 60)
                                        setSlotPopup({ day, hour, apts, x: e.clientX, y: e.clientY })
                                      }}
                                    >
                                      <p className={cn('text-[11px] font-bold', staffTextColors[colorIdx])}>
                                        {apts.length} randevu
                                      </p>
                                    </div>
                                  )
                                })}
                                {/* Bireysel bloklar (1-2 çakışan) */}
                                {layout.filter(i => !mergedIds.has(i.apt.id)).map(({ apt, column, totalColumns }) => {
                                  const startMin = toMinutes(apt.start_time) - startHour * 60
                                  const endMin = toMinutes(apt.end_time) - startHour * 60
                                  const topPos = (startMin / 60) * hourHeight
                                  const h = Math.max(((endMin - startMin) / 60) * hourHeight, 20)
                                  const colorIdx = getStaffColorIndex(apt.staff_id)
                                  const colWidth = 100 / totalColumns
                                  const colLeft = column * colWidth
                                  const isAptUnresolved = isPastUnresolved(apt)
                                  const visual = getAptVisual(apt)
                                  return (
                                    <div
                                      key={apt.id}
                                      className="absolute"
                                      style={{ top: topPos, height: h, left: `${colLeft}%`, width: `${colWidth - 1}%` }}
                                    >
                                      {isAptUnresolved && (
                                        <span
                                          className="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-gray-900 pointer-events-none"
                                          title={apt.status === 'completed' ? 'Tahsilat yapılmamış' : 'Sonuç girilmemiş'}
                                        />
                                      )}
                                      <div
                                        className={cn(
                                          'absolute inset-0 rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity',
                                          staffColors[colorIdx],
                                          visual.isActive ? 'ring-2 ring-inset ring-green-500' :
                                          visual.isUnconfirmed ? 'ring-2 ring-inset ring-orange-400' :
                                          'border border-white/20'
                                        )}
                                        style={{ opacity: visual.isDim ? 0.5 : 1 }}
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onMouseUp={(e) => e.stopPropagation()}
                                        onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt) }}
                                      >
                                        <p className={cn('text-[10px] font-semibold truncate', staffTextColors[colorIdx])}>
                                          {apt.customers?.name || 'İsimsiz'}
                                        </p>
                                        {h > 30 && (
                                          <p className={cn('text-[9px] truncate opacity-75', staffTextColors[colorIdx])}>
                                            {apt.services?.name || ''} · {formatTime(apt.start_time)}
                                          </p>
                                        )}
                                        {apt.staff_members?.name && h > 24 && (
                                          <p className={cn('text-[8px] truncate opacity-60 absolute bottom-0.5 right-1 max-w-[90%] text-right', staffTextColors[colorIdx])}>
                                            {apt.staff_members.name}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </>
                            )
                          })()}

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
                  const dayApts = filteredAppointments
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
                      <div className="flex flex-col gap-1.5">
                        {visible.map((apt) => {
                          const colorIdx = getStaffColorIndex(apt.staff_id)
                          const unresolved = isPastUnresolved(apt)
                          return (
                            <div key={apt.id} className="relative">
                              {unresolved && (
                                <span className="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-gray-900 pointer-events-none" />
                              )}
                              <div
                                onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt) }}
                                style={{ opacity: isPast(apt) ? 0.5 : 1 }}
                                className={cn(
                                  'rounded px-1.5 py-0.5 text-[10px] font-medium truncate cursor-pointer border border-white/20 hover:opacity-90',
                                  staffColors[colorIdx],
                                  staffTextColors[colorIdx]
                                )}
                              >
                                {formatTime(apt.start_time)} {apt.customers?.name || 'İsimsiz'}
                              </div>
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
      ) : viewMode === 'staff' ? (
        /* ── Personel Takvimi — günlük, her kolon bir personel ── */
        (() => {
          const dayApts = filteredAppointments.filter(a => a.appointment_date === selectedDate)
          const staffColors = ['bg-blue-200 dark:bg-blue-800', 'bg-green-200 dark:bg-green-800', 'bg-purple-200 dark:bg-purple-800', 'bg-amber-200 dark:bg-amber-800', 'bg-pink-200 dark:bg-pink-800', 'bg-cyan-200 dark:bg-cyan-800', 'bg-orange-200 dark:bg-orange-800', 'bg-rose-200 dark:bg-rose-800']
          const staffTextColors = ['text-blue-800 dark:text-blue-200', 'text-green-800 dark:text-green-200', 'text-purple-800 dark:text-purple-200', 'text-amber-800 dark:text-amber-200', 'text-pink-800 dark:text-pink-200', 'text-cyan-800 dark:text-cyan-200', 'text-orange-800 dark:text-orange-200', 'text-rose-800 dark:text-rose-200']
          const hourHeight = 60
          const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

          let startHour = 8, endHour = 21
          if (workingHours) {
            const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
            const opens = keys.map(k => workingHours[k]?.open).filter(Boolean).map(t => parseInt(t!))
            const closes = keys.map(k => workingHours[k]?.close).filter(Boolean).map(t => parseInt(t!))
            if (opens.length) startHour = Math.min(...opens)
            if (closes.length) endHour = Math.max(...closes)
          }
          const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour)

          // Sütunlar: aktif personel listesi + "Atanmamış" sütunu (varsa)
          const unassigned = dayApts.filter(a => !a.staff_id)
          const columns = [
            ...staffMembers.map((s, i) => ({
              id: s.id,
              label: s.name,
              apts: dayApts.filter(a => a.staff_id === s.id),
              colorIdx: i % staffColors.length,
            })),
            ...(unassigned.length > 0 ? [{ id: '__unassigned__', label: 'Atanmamış', apts: unassigned, colorIdx: staffColors.length - 1 }] : []),
          ]

          if (columns.length === 0) {
            return (
              <EmptyState
                icon={<Users className="h-7 w-7" />}
                title="Aktif personel bulunamadı"
                description="Personel Ayarları'ndan personel ekleyin."
              />
            )
          }

          return (
            <div className="card overflow-hidden !p-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                <div className="relative" style={{ minWidth: `${60 + columns.length * 140}px` }}>
                  {/* Başlık satırı */}
                  <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 grid" style={{ gridTemplateColumns: `60px repeat(${columns.length}, 1fr)` }}>
                    <div className="p-2" />
                    {columns.map((col, i) => (
                      <div key={col.id} className={cn('p-2 text-center border-l border-gray-200 dark:border-gray-700', i === 0 && 'border-l-0')}>
                        <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{col.label}</p>
                        <p className="text-xs text-gray-400">{col.apts.length} randevu</p>
                      </div>
                    ))}
                  </div>

                  {/* Grid gövdesi */}
                  <div className="relative select-none" style={{ height: hours.length * hourHeight }}>
                    {/* Saat etiketleri */}
                    {hours.map((hour, i) => (
                      <div key={`h-${hour}`} className="absolute left-0 w-[60px] text-right pr-2 text-xs text-gray-400" style={{ top: i === 0 ? 2 : i * hourHeight - 6 }}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                    {/* Yatay çizgiler */}
                    {hours.map((_, i) => (
                      <div key={`line-${i}`} className="absolute left-[60px] right-0 border-t border-gray-100 dark:border-gray-800" style={{ top: i * hourHeight }} />
                    ))}
                    {/* Personel kolonları */}
                    {columns.map((col, colIdx) => {
                      const colData = columns.map(c => ({ id: c.id, date: selectedDate }))
                      return (
                      <div
                        key={col.id}
                        className="absolute border-l border-gray-100 dark:border-gray-800"
                        style={{
                          left: `calc(60px + ${colIdx} * ((100% - 60px) / ${columns.length}))`,
                          width: `calc((100% - 60px) / ${columns.length})`,
                          top: 0, height: '100%',
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const hour = Math.max(startHour, Math.min(endHour, Math.floor((e.clientY - rect.top) / hourHeight) + startHour))
                          setSelectionStart({ col: colIdx, hour })
                          setSelectionEnd({ col: colIdx, hour })
                          setIsSelecting(true)
                          setSelectionViewMode('staff')
                          setActionMenu(null)
                          e.preventDefault()
                        }}
                        onMouseMove={(e) => {
                          if (!isSelecting || selectionViewMode !== 'staff') return
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const hour = Math.max(startHour, Math.min(endHour, Math.floor((e.clientY - rect.top) / hourHeight) + startHour))
                          setSelectionEnd({ col: colIdx, hour })
                        }}
                        onMouseUp={(e) => {
                          if (!isSelecting || selectionViewMode !== 'staff' || !selectionStart || !selectionEnd) return
                          setIsSelecting(false)
                          const cells = getSelectedCells(selectionStart, selectionEnd, colData)
                          if (cells.length <= 1 && selectionStart.col === selectionEnd.col && selectionStart.hour === selectionEnd.hour) {
                            // Tek hücre tıklama — bloklu ise unblock, yoksa yeni randevu
                            const blocked = getBlockedSlotAt(selectedDate, selectionStart.hour, col.id !== '__unassigned__' ? col.id : null, null)
                            if (blocked) {
                              handleUnblock(blocked.id)
                            } else {
                              openNewModal(selectedDate, `${String(selectionStart.hour).padStart(2, '0')}:00`)
                            }
                            clearSelection()
                            return
                          }
                          setActionMenu({ x: e.clientX, y: e.clientY, cells })
                        }}
                      >
                        {/* Bloklanmış saatler */}
                        {hours.map(hour => {
                          const blocked = isHourBlocked(selectedDate, hour, col.id !== '__unassigned__' ? col.id : null, null)
                          if (!blocked) return null
                          return (
                            <div
                              key={`blocked-${hour}`}
                              className="absolute left-0 right-0 bg-gray-200/60 dark:bg-gray-700/60 border-y border-gray-300/50 dark:border-gray-600/50 cursor-pointer"
                              style={{ top: (hour - startHour) * hourHeight, height: hourHeight }}
                              title="Bloklanmış — tıklayarak açabilirsiniz"
                            >
                              <div className="flex items-center justify-center h-full opacity-40">
                                <Ban className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                              </div>
                            </div>
                          )
                        })}
                        {/* Seçim highlight */}
                        {(isSelecting || actionMenu) && selectionViewMode === 'staff' && hours.map(hour => {
                          if (!isCellSelected(colIdx, hour)) return null
                          return (
                            <div
                              key={`sel-${hour}`}
                              className="absolute left-0 right-0 bg-pulse-900/20 dark:bg-pulse-400/20 border border-pulse-900/30 dark:border-pulse-400/30 pointer-events-none z-[5]"
                              style={{ top: (hour - startHour) * hourHeight, height: hourHeight }}
                            />
                          )
                        })}
                        {/* Çakışan randevuları yan yana sub-kolonlara dağıt — tek
                             tıklamayla diğer randevu da seçilebilsin (z-index altında kalmasın) */}
                        {computeOverlapLayout(col.apts).map(({ apt, column, totalColumns }) => {
                          const startMin = toMinutes(apt.start_time) - startHour * 60
                          const endMin = toMinutes(apt.end_time) - startHour * 60
                          const top = (startMin / 60) * hourHeight
                          const height = Math.max(((endMin - startMin) / 60) * hourHeight, 20)
                          const visual = getAptVisual(apt)
                          const isAptUnresolved = isPastUnresolved(apt)
                          // Sub-kolon hesabı: aynı saatte birden fazla randevu varsa yan yana
                          const widthPercent = 100 / totalColumns
                          const leftPercent = column * widthPercent
                          return (
                            <div
                              key={apt.id}
                              className="absolute"
                              style={{
                                top, height,
                                left: `calc(${leftPercent}% + 2px)`,
                                width: `calc(${widthPercent}% - 4px)`,
                              }}
                            >
                              {isAptUnresolved && (
                                <span
                                  className="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-gray-900 pointer-events-none"
                                  title={apt.status === 'completed' ? 'Tahsilat yapılmamış' : 'Sonuç girilmemiş'}
                                />
                              )}
                              <div
                                className={cn(
                                  'absolute inset-0 rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:opacity-90 transition-opacity',
                                  staffColors[col.colorIdx],
                                  visual.isActive ? 'ring-2 ring-inset ring-green-500' :
                                  visual.isUnconfirmed ? 'ring-2 ring-inset ring-orange-400' :
                                  'border border-white/20'
                                )}
                                style={{ opacity: visual.isDim ? 0.5 : 1 }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt) }}
                              >
                                <p className={cn('text-[10px] font-semibold truncate', staffTextColors[col.colorIdx])}>
                                  {apt.customers?.name || 'İsimsiz'}
                                </p>
                                {height > 30 && (
                                  <p className={cn('text-[9px] truncate opacity-75', staffTextColors[col.colorIdx])}>
                                    {apt.services?.name} · {formatTime(apt.start_time)}
                                  </p>
                                )}
                                {apt.staff_members?.name && height > 24 && (
                                  <p className={cn('text-[8px] truncate opacity-60 absolute bottom-0.5 right-1 max-w-[90%] text-right', staffTextColors[col.colorIdx])}>
                                    {apt.staff_members.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {/* Şu anki saat çizgisi (bugün için) */}
                        {selectedDate === formatDateISO(new Date()) && now && colIdx === 0 && (() => {
                          const currentMin = (now.getHours() * 60 + now.getMinutes()) - startHour * 60
                          if (currentMin < 0 || currentMin > hours.length * 60) return null
                          return (
                            <div className="absolute left-0 right-0 z-10 pointer-events-none" style={{ top: (currentMin / 60) * hourHeight, width: `${columns.length * 100}%` }}>
                              <div className="flex items-center">
                                <div className="h-2.5 w-2.5 rounded-full bg-red-500 -ml-1 flex-shrink-0" />
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
      ) : viewMode === 'room' ? (
        /* ── Oda Takvimi — günlük, her kolon bir oda ── */
        (() => {
          if (rooms.length === 0) {
            return (
              <EmptyState
                icon={<Building2 className="h-7 w-7" />}
                title="Henüz oda tanımlanmamış"
                description="Ayarlar → İşletme Bilgileri bölümünden odaları ekleyin."
              />
            )
          }

          const dayApts = filteredAppointments.filter(a => a.appointment_date === selectedDate)
          const hourHeight = 60
          const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }

          let startHour = 8, endHour = 21
          if (workingHours) {
            const keys = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
            const opens = keys.map(k => workingHours[k]?.open).filter(Boolean).map(t => parseInt(t!))
            const closes = keys.map(k => workingHours[k]?.close).filter(Boolean).map(t => parseInt(t!))
            if (opens.length) startHour = Math.min(...opens)
            if (closes.length) endHour = Math.max(...closes)
          }
          const hours = Array.from({ length: endHour - startHour + 1 }, (_, i) => i + startHour)

          // Sütunlar: odalar + "Oda atanmamış"
          const unassigned = dayApts.filter(a => !(a as AppointmentView & { room_id?: string }).room_id)
          const columns = [
            ...rooms.map((r) => ({
              id: r.id,
              label: r.name,
              color: r.color || '#6366f1',
              apts: dayApts.filter(a => (a as AppointmentView & { room_id?: string }).room_id === r.id),
            })),
            { id: '__unassigned__', label: 'Oda atanmamış', color: '#9ca3af', apts: unassigned },
          ]

          return (
            <div className="card overflow-hidden !p-0">
              <div className="overflow-x-auto overflow-y-auto max-h-[70vh]">
                <div className="relative" style={{ minWidth: `${60 + columns.length * 140}px` }}>
                  {/* Başlık satırı */}
                  <div className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 grid" style={{ gridTemplateColumns: `60px repeat(${columns.length}, 1fr)` }}>
                    <div className="p-2" />
                    {columns.map((col, i) => (
                      <div key={col.id} className={cn('p-2 text-center border-l border-gray-200 dark:border-gray-700', i === 0 && 'border-l-0')}>
                        <div className="flex items-center justify-center gap-1.5">
                          <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: col.color }} />
                          <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate">{col.label}</p>
                        </div>
                        <p className="text-xs text-gray-400">{col.apts.length} randevu</p>
                      </div>
                    ))}
                  </div>

                  {/* Grid gövdesi */}
                  <div className="relative select-none" style={{ height: hours.length * hourHeight }}>
                    {hours.map((hour, i) => (
                      <div key={`h-${hour}`} className="absolute left-0 w-[60px] text-right pr-2 text-xs text-gray-400" style={{ top: i === 0 ? 2 : i * hourHeight - 6 }}>
                        {String(hour).padStart(2, '0')}:00
                      </div>
                    ))}
                    {hours.map((_, i) => (
                      <div key={`line-${i}`} className="absolute left-[60px] right-0 border-t border-gray-100 dark:border-gray-800" style={{ top: i * hourHeight }} />
                    ))}
                    {columns.map((col, colIdx) => {
                      const colData = columns.map(c => ({ id: c.id, date: selectedDate }))
                      return (
                      <div
                        key={col.id}
                        className="absolute border-l border-gray-100 dark:border-gray-800"
                        style={{
                          left: `calc(60px + ${colIdx} * ((100% - 60px) / ${columns.length}))`,
                          width: `calc((100% - 60px) / ${columns.length})`,
                          top: 0, height: '100%',
                        }}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const hour = Math.max(startHour, Math.min(endHour, Math.floor((e.clientY - rect.top) / hourHeight) + startHour))
                          setSelectionStart({ col: colIdx, hour })
                          setSelectionEnd({ col: colIdx, hour })
                          setIsSelecting(true)
                          setSelectionViewMode('room')
                          setActionMenu(null)
                          e.preventDefault()
                        }}
                        onMouseMove={(e) => {
                          if (!isSelecting || selectionViewMode !== 'room') return
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                          const hour = Math.max(startHour, Math.min(endHour, Math.floor((e.clientY - rect.top) / hourHeight) + startHour))
                          setSelectionEnd({ col: colIdx, hour })
                        }}
                        onMouseUp={(e) => {
                          if (!isSelecting || selectionViewMode !== 'room' || !selectionStart || !selectionEnd) return
                          setIsSelecting(false)
                          const cells = getSelectedCells(selectionStart, selectionEnd, colData)
                          if (cells.length <= 1 && selectionStart.col === selectionEnd.col && selectionStart.hour === selectionEnd.hour) {
                            const blocked = getBlockedSlotAt(selectedDate, selectionStart.hour, null, col.id !== '__unassigned__' ? col.id : null)
                            if (blocked) {
                              handleUnblock(blocked.id)
                            } else {
                              openNewModal(selectedDate, `${String(selectionStart.hour).padStart(2, '0')}:00`)
                            }
                            clearSelection()
                            return
                          }
                          setActionMenu({ x: e.clientX, y: e.clientY, cells })
                        }}
                      >
                        {/* Bloklanmış saatler */}
                        {hours.map(hour => {
                          const blocked = isHourBlocked(selectedDate, hour, null, col.id !== '__unassigned__' ? col.id : null)
                          if (!blocked) return null
                          return (
                            <div
                              key={`blocked-${hour}`}
                              className="absolute left-0 right-0 bg-gray-200/60 dark:bg-gray-700/60 border-y border-gray-300/50 dark:border-gray-600/50 cursor-pointer"
                              style={{ top: (hour - startHour) * hourHeight, height: hourHeight }}
                              title="Bloklanmış — tıklayarak açabilirsiniz"
                            >
                              <div className="flex items-center justify-center h-full opacity-40">
                                <Ban className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                              </div>
                            </div>
                          )
                        })}
                        {/* Seçim highlight */}
                        {(isSelecting || actionMenu) && selectionViewMode === 'room' && hours.map(hour => {
                          if (!isCellSelected(colIdx, hour)) return null
                          return (
                            <div
                              key={`sel-${hour}`}
                              className="absolute left-0 right-0 bg-pulse-900/20 dark:bg-pulse-400/20 border border-pulse-900/30 dark:border-pulse-400/30 pointer-events-none z-[5]"
                              style={{ top: (hour - startHour) * hourHeight, height: hourHeight }}
                            />
                          )
                        })}
                        {/* Çakışan randevular yan yana — tek tıklamada doğru randevu açılsın */}
                        {computeOverlapLayout(col.apts).map(({ apt, column, totalColumns }) => {
                          const startMin = toMinutes(apt.start_time) - startHour * 60
                          const endMin = toMinutes(apt.end_time) - startHour * 60
                          const top = (startMin / 60) * hourHeight
                          const height = Math.max(((endMin - startMin) / 60) * hourHeight, 20)
                          const visual = getAptVisual(apt)
                          const isAptUnresolved = isPastUnresolved(apt)
                          const widthPercent = 100 / totalColumns
                          const leftPercent = column * widthPercent
                          return (
                            <div
                              key={apt.id}
                              className="absolute"
                              style={{
                                top, height,
                                left: `calc(${leftPercent}% + 2px)`,
                                width: `calc(${widthPercent}% - 4px)`,
                              }}
                            >
                              {isAptUnresolved && (
                                <span
                                  className="absolute -top-1 -right-1 z-10 h-2.5 w-2.5 rounded-full bg-red-500 border-2 border-gray-900 pointer-events-none"
                                  title={apt.status === 'completed' ? 'Tahsilat yapılmamış' : 'Sonuç girilmemiş'}
                                />
                              )}
                              <div
                                className={cn(
                                  'absolute inset-0 rounded-md px-1.5 py-0.5 overflow-hidden cursor-pointer hover:opacity-80 transition-opacity text-white',
                                  visual.isActive ? 'ring-2 ring-inset ring-green-500' :
                                  visual.isUnconfirmed ? 'ring-2 ring-inset ring-orange-400' :
                                  'border border-white/20'
                                )}
                                style={{ backgroundColor: col.color, opacity: visual.isDim ? 0.5 : 1 }}
                                onMouseDown={(e) => e.stopPropagation()}
                                onMouseUp={(e) => e.stopPropagation()}
                                onClick={(e) => { e.stopPropagation(); setSelectedAppointment(apt) }}
                              >
                                <p className="text-[10px] font-semibold truncate">{apt.customers?.name || 'İsimsiz'}</p>
                                {height > 30 && (
                                  <p className="text-[9px] truncate opacity-80">{apt.services?.name} · {formatTime(apt.start_time)}</p>
                                )}
                                {apt.staff_members?.name && height > 24 && (
                                  <p className="text-[8px] truncate opacity-60 absolute bottom-0.5 right-1 max-w-[90%] text-right">
                                    {apt.staff_members.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )
        })()
      ) : null}

      {/* Saat dilimi popup (çakışan randevular) */}
      {slotPopup && (
        <Portal>
        <div className="fixed inset-0 z-[60]" onClick={() => setSlotPopup(null)}>
          <div
            className="absolute z-[60] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 w-72 modal-content"
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
        </Portal>
      )}

      {/* Seçim sonrası aksiyon menüsü */}
      {actionMenu && (
        <Portal>
          <div className="fixed inset-0 z-[60]" onClick={clearSelection}>
            <div
              className="absolute z-[60] bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-3 w-56 modal-content"
              style={{
                top: typeof window !== 'undefined' ? Math.min(actionMenu.y - 10, window.innerHeight - 200) : actionMenu.y - 10,
                left: typeof window !== 'undefined' ? Math.min(actionMenu.x - 10, window.innerWidth - 260) : actionMenu.x - 10,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const blockStatus = getSelectionBlockStatus(actionMenu.cells)
                const sortedCells = [...actionMenu.cells].sort((a, b) => a.hour - b.hour || a.col - b.col)
                const minHour = sortedCells[0]?.hour ?? 0
                const maxHour = sortedCells[sortedCells.length - 1]?.hour ?? 0
                return (
                  <>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                      {actionMenu.cells.length} saat seçildi
                      <span className="text-gray-400 ml-1">({String(minHour).padStart(2, '0')}:00 – {String(maxHour + 1).padStart(2, '0')}:00)</span>
                    </p>
                    <div className="space-y-1">
                      {blockStatus !== 'all_blocked' && (
                        <button
                          onClick={() => {
                            const firstCell = sortedCells[0]
                            const startTimeStr = `${String(minHour).padStart(2, '0')}:00`
                            const endTimeStr = `${String(maxHour + 1).padStart(2, '0')}:00`
                            setEditingAppointment(null)
                            setCustomerId(''); setServiceId(''); setStaffId(
                              selectionViewMode === 'staff' && firstCell.colId !== '__unassigned__' ? firstCell.colId : ''
                            ); setRoomId(
                              selectionViewMode === 'room' && firstCell.colId !== '__unassigned__' ? firstCell.colId : ''
                            )
                            setDate(firstCell.date); setStartTime(startTimeStr); setEndTime(endTimeStr); setNotes('')
                            setIsRecurring(false); setRecurrenceFrequency('weekly'); setRecurrenceCount(4)
                            setError(null); setShowModal(true)
                            clearSelection()
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Plus className="h-4 w-4 text-pulse-900 dark:text-pulse-400" />
                          Randevu Oluştur
                        </button>
                      )}
                      {blockStatus === 'all_blocked' ? (
                        <button
                          onClick={() => {
                            handleBulkUnblock(actionMenu.cells)
                            clearSelection()
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Ban className="h-4 w-4 text-green-500" />
                          Blok İptal
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            handleBlockSlots(actionMenu.cells)
                            clearSelection()
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Lock className="h-4 w-4 text-red-500" />
                          Saati Blokla
                        </button>
                      )}
                    </div>
                  </>
                )
              })()}
            </div>
          </div>
        </Portal>
      )}

      {!loading && viewMode !== 'week' && viewMode !== 'month' && viewMode !== 'staff' && viewMode !== 'room' ? (filteredAppointments.length === 0 ? (
        <EmptyState
          icon={isSelectedDayClosed && !search && !statusFilter
            ? <Ban className="h-7 w-7" />
            : <Calendar className="h-7 w-7" />}
          title={search || statusFilter
            ? 'Filtreye uygun randevu bulunamadı'
            : isSelectedDayClosed
              ? 'İşletme bu gün kapalı'
              : 'Bu tarihte randevu yok'}
          description={isSelectedDayClosed && !search && !statusFilter
            ? 'Çalışma saatleri ayarlarından kapalı günler düzenlenebilir.'
            : undefined}
          action={!search && !statusFilter && !isSelectedDayClosed ? {
            label: 'Randevu Ekle',
            onClick: () => openNewModal(),
            icon: <Plus className="mr-2 h-4 w-4" />,
          } : undefined}
        />
      ) : (
        <div key={viewMode} className="view-transition">
        {viewMode === 'list' ? (
        <AnimatedList className="space-y-2">
          {filteredAppointments.map((apt) => {
            const visual = getAptVisual(apt)
            return (
              <AnimatedItem
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  'rounded-2xl border px-4 py-3 transition-all cursor-pointer',
                  'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50',
                  'hover:border-gray-200 dark:hover:border-gray-700 hover:shadow-sm',
                  visual.isDim && 'opacity-60',
                  visual.isActive && 'border-green-400 dark:border-green-600 ring-1 ring-green-400 dark:ring-green-600',
                  visual.isUnconfirmed && 'border-orange-400 dark:border-orange-500 ring-1 ring-orange-400 dark:ring-orange-500',
                  isPastUnresolved(apt) && UNRESOLVED_BORDER_ONLY,
                  selectedAppointment?.id === apt.id && 'ring-2 ring-pulse-900 border-pulse-300 dark:border-pulse-700',
                )}
              >
                <div className="flex items-center gap-3">
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
                      {apt.package_name && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" title={apt.package_name}>
                          <Package className="h-3 w-3" /> Paket
                        </span>
                      )}
                      {isPastUnresolved(apt) && <span className="h-2.5 w-2.5 rounded-full bg-red-500 flex-shrink-0" title={apt.status === 'completed' ? 'Tahsilat yapılmamış' : 'Sonuç girilmemiş'} />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      {apt.services?.name && <span>{apt.services.name}</span>}
                      {apt.package_unit_price != null
                        ? <><span>·</span><span className="text-amber-600 dark:text-amber-400 font-medium">{formatCurrency(apt.package_unit_price)}/seans</span></>
                        : apt.services?.price ? <><span>·</span><span>{formatCurrency(apt.services.price)}</span></> : null
                      }
                      {apt.staff_members?.name && <><span>·</span><span>{apt.staff_members.name}</span></>}
                      {apt.notes && <><span>·</span><span className="truncate italic">{apt.notes}</span></>}
                    </div>
                  </div>
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <ActionButtons apt={apt} size="md" todayStr={todayStr} fillGapLoading={fillGapLoading} statusLoadingAction={statusLoadingAction} onEdit={openEditModal} onReschedule={openRescheduleModal} onUpdateStatus={updateStatus} onCancelConfirm={openCancelConfirm} onFillGap={handleFillGap} onDelete={handleDeleteAppointment} onQuickPayment={setQuickPaymentTarget} onFollowUp={setFollowUpTarget} />
                  </div>
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      ) : (
        <AnimatedList className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(190px,220px))]">
          {filteredAppointments.map((apt) => {
            const visual = getAptVisual(apt)
            return (
              <AnimatedItem
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  'relative rounded-2xl border p-4 transition-all cursor-pointer hover:shadow-md flex flex-col',
                  'border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900/50',
                  visual.isDim && 'opacity-60',
                  visual.isActive && 'border-green-400 ring-1 ring-green-400',
                  visual.isUnconfirmed && 'border-orange-400 dark:border-orange-500 ring-1 ring-orange-400 dark:ring-orange-500',
                  isPastUnresolved(apt) && UNRESOLVED_BORDER_ONLY,
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
                {/* Time */}
                <div className="mb-3">
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100 tabular-nums">{formatTime(apt.start_time)}</p>
                  <p className="text-xs text-gray-400 tabular-nums">{formatTime(apt.end_time)}</p>
                </div>
                <div className="flex items-center gap-1 mb-2 flex-wrap">
                  <span className={`badge text-xs ${getStatusColor(apt.status)}`}>{STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}</span>
                  {apt.recurrence_group_id && <Repeat className="h-3 w-3 text-purple-400" />}
                  {apt.package_name && <Package className="h-3 w-3 text-amber-500" aria-label={apt.package_name} />}
                </div>
                <p className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">{apt.customers?.name || 'İsimsiz'}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{apt.services?.name || '—'}</p>
                {apt.staff_members?.name && <p className="text-xs text-gray-400 truncate">{apt.staff_members.name}</p>}
                {apt.package_unit_price != null
                  ? <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mt-1">{formatCurrency(apt.package_unit_price)}/seans</p>
                  : apt.services?.price ? <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-1">{formatCurrency(apt.services.price)}</p> : null
                }

                <div className="mt-auto pt-3 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <ActionButtons apt={apt} size="sm" todayStr={todayStr} fillGapLoading={fillGapLoading} statusLoadingAction={statusLoadingAction} onEdit={openEditModal} onReschedule={openRescheduleModal} onUpdateStatus={updateStatus} onCancelConfirm={openCancelConfirm} onFillGap={handleFillGap} onDelete={handleDeleteAppointment} onQuickPayment={setQuickPaymentTarget} onFollowUp={setFollowUpTarget} />
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
        )}
        </div>
      )) : null}

      {/* ── Detay Slide-Over Paneli ── */}
      {selectedAppointment && (
        <Portal>
          <div className="fixed inset-0 z-[60] bg-black/50 dark:bg-black/70" onClick={closePanelAnimated} />
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
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <span className={`badge ${getStatusColor(selectedAppointment.status)}`}>
                    {STATUS_LABELS[selectedAppointment.status as keyof typeof STATUS_LABELS]}
                  </span>
                  {selectedAppointment.recurrence_group_id && (
                    <span className="badge bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                      <Repeat className="h-3 w-3 mr-1" />Tekrarlayan
                    </span>
                  )}
                  {selectedAppointment.campaigns?.name && (
                    <span
                      className="badge bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      title={`Kampanya: ${selectedAppointment.campaigns.name}`}
                    >
                      <Sparkles className="h-3 w-3 mr-1" />
                      {selectedAppointment.campaigns.name}
                    </span>
                  )}
                  {(selectedAppointment as AppointmentView).package_name && (
                    <span className="badge bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300">
                      <Package className="h-3 w-3 mr-1" />
                      {(selectedAppointment as AppointmentView).package_name}
                      {(selectedAppointment as AppointmentView).package_unit_price != null && (
                        <> · {formatCurrency((selectedAppointment as AppointmentView).package_unit_price!)}/seans</>
                      )}
                    </span>
                  )}
                </div>
              </div>

              {/* Pending randevu için hızlı onay banner'ı — bekleme listesi hold'ları ile online randevuları ayır */}
              {selectedAppointment.status === 'pending' && (() => {
                const apt = selectedAppointment as AppointmentView & { held_until?: string | null; held_for_waitlist_entry_id?: string | null }
                const isHeld = !!(apt.held_for_waitlist_entry_id || apt.held_until)
                const holdRemaining = (() => {
                  if (!apt.held_until) return null
                  const diff = new Date(apt.held_until).getTime() - Date.now()
                  if (diff <= 0) return 'Süresi doldu'
                  const m = Math.floor(diff / 60000)
                  const s = Math.floor((diff % 60000) / 1000)
                  return `${m}:${String(s).padStart(2, '0')}`
                })()

                if (isHeld) {
                  // Bekleme listesinden oluşturulmuş hold — müşteri SMS ile onay bekleniyor
                  return (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-800 p-4 flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Müşteri Onayı Bekleniyor</p>
                          {holdRemaining && (
                            <span className={cn(
                              'text-[11px] px-2 py-0.5 rounded-full font-medium tabular-nums',
                              holdRemaining === 'Süresi doldu'
                                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300'
                                : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            )}>
                              {holdRemaining === 'Süresi doldu' ? 'Süresi doldu' : `Kalan ${holdRemaining}`}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-blue-800 dark:text-blue-300 mt-1 leading-relaxed">
                          Bekleme listesinden oluşturuldu. {customerLabel.toLowerCase()}ya SMS gönderildi — link üzerinden kendi onaylayabilir.
                          Süre dolarsa rezervasyon iptal edilir ve sıradaki kişiye geçilir.
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <button
                            onClick={() => updateStatus(selectedAppointment.id, 'confirmed')}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-blue-300 dark:border-blue-700 bg-white dark:bg-gray-900 text-blue-700 dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 px-3 py-1.5 text-xs font-medium transition-colors"
                            title="Müşteri yerine personel olarak onayla (örn: telefonda onayladı)"
                          >
                            <CheckCircle className="h-3.5 w-3.5" /> Personel olarak onayla
                          </button>
                          <button
                            onClick={(e) => openCancelConfirm(selectedAppointment, e)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-800 bg-white dark:bg-gray-900 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30 px-3 py-1.5 text-xs font-medium transition-colors"
                          >
                            <XCircle className="h-3.5 w-3.5" /> Rezervasyonu iptal et
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                }

                // Online randevu — personel onayı gerektirir
                return (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-800 p-4 flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <BellRing className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Onay Bekliyor</p>
                      <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                        Müşteri online randevu aldı. Onaylamak için aşağıdaki butona basın.
                      </p>
                      <button
                        onClick={() => updateStatus(selectedAppointment.id, 'confirmed')}
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white px-3 py-1.5 text-sm font-medium transition-colors"
                      >
                        <CheckCircle className="h-4 w-4" /> Şimdi Onayla
                      </button>
                    </div>
                  </div>
                )
              })()}

              {/* Bilgiler */}
              <div className="space-y-3">
                <DetailRow label={customerLabel} value={
                  <div className="flex items-center gap-2">
                    <span>{selectedAppointment.customers?.name || 'İsimsiz'}</span>
                    {selectedAppointment.customer_id && (
                      <Link
                        href={`/dashboard/customers?customerId=${selectedAppointment.customer_id}`}
                        className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                        title={`${customerLabel} profiline git`}
                      >
                        <User className="h-3 w-3" />
                        Profil
                        <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                      </Link>
                    )}
                  </div>
                } />
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

              {/* Öncesi/Sonrası Fotoğraflar — yalnızca müşteriye bağlı randevularda */}
              {selectedAppointment.customer_id && (
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <GalleryTab
                    customerId={selectedAppointment.customer_id}
                    appointmentId={selectedAppointment.id}
                    appointmentStatus={selectedAppointment.status as 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'}
                    filterByAppointment
                    canWrite={writePermissions?.appointments ?? permissions?.appointments ?? false}
                  />
                </div>
              )}

              {/* Aksiyonlar */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                {(selectedAppointment.status === 'confirmed' || selectedAppointment.status === 'pending') && (
                  <>
                    <button onClick={(e) => { openEditModal(selectedAppointment, e) }} className="btn-secondary w-full justify-start gap-2">
                      <Pencil className="h-4 w-4" /> Düzenle
                    </button>
                    <button onClick={(e) => { openRescheduleModal(selectedAppointment, e) }} className="w-full flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors">
                      <CalendarClock className="h-4 w-4" /> Ertele
                    </button>
                  </>
                )}
                {selectedAppointment.status === 'completed' && (() => {
                  // Tahsilat butonunu gizleme koşulları:
                  //   1) Paket seansı: ödeme paket satıldığında alındı
                  //   2) Faturası ödenmiş randevu: paid_amount > 0 veya status='paid'
                  const apt = selectedAppointment as AppointmentView
                  const isPackageSession = !!apt.customer_package_id
                  const invs = Array.isArray(apt.invoices) ? apt.invoices : []
                  const isAlreadyPaid = invs.some(i => i.status === 'paid' || (i.paid_amount ?? 0) > 0)
                  const paymentLocked = isPackageSession || isAlreadyPaid
                  return (
                  <>
                    {paymentLocked ? (
                      <div className="w-full flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle className="h-4 w-4" />
                        {isPackageSession ? 'Ödeme paket satışında alındı' : 'Tahsilat tamamlandı'}
                      </div>
                    ) : (
                      <button
                        onClick={() => setQuickPaymentTarget(selectedAppointment)}
                        className="w-full flex items-center gap-2 rounded-lg border border-pulse-200 dark:border-pulse-800 bg-pulse-50 dark:bg-pulse-900/20 px-4 py-2.5 text-sm font-medium text-pulse-900 dark:text-pulse-300 hover:bg-pulse-100 dark:hover:bg-pulse-800/30 transition-colors"
                      >
                        <Wallet className="h-4 w-4" /> Tahsilat Al
                      </button>
                    )}
                    {selectedAppointment.customer_id && selectedAppointment.customers?.name && (
                      <button
                        onClick={() => setFollowUpTarget({
                          appointmentId: selectedAppointment.id,
                          customerId: selectedAppointment.customer_id!,
                          customerName: selectedAppointment.customers!.name,
                        })}
                        className="w-full flex items-center gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 transition-colors"
                      >
                        <BellRing className="h-4 w-4" /> Takip Başlat
                      </button>
                    )}
                    <button
                      onClick={() => handleRevertCompleted(selectedAppointment.id)}
                      className="w-full flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <RotateCcw className="h-4 w-4" /> Tamamlandı Geri Al
                    </button>
                  </>
                  )
                })()}
                {selectedAppointment.status === 'confirmed' && (() => {
                  const aptId = selectedAppointment.id
                  const completing = isLoading(aptId, 'completed')
                  const noShowing = isLoading(aptId, 'no_show')
                  const anyLoading = isLoading(aptId)
                  return (
                    <>
                      <button onClick={() => updateStatus(aptId, 'completed')} disabled={anyLoading} className={cn('w-full flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800/30 transition-colors', anyLoading && 'opacity-60 cursor-not-allowed')}>
                        {completing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                        {completing ? 'Tamamlanıyor...' : 'Tamamlandı İşaretle'}
                      </button>
                      <button onClick={() => updateStatus(aptId, 'no_show')} disabled={anyLoading} className={cn('w-full flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-800/30 transition-colors', anyLoading && 'opacity-60 cursor-not-allowed')}>
                        {noShowing ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
                        {noShowing ? 'İşaretleniyor...' : 'Gelmedi İşaretle'}
                      </button>
                      <button onClick={(e) => openCancelConfirm(selectedAppointment, e)} disabled={anyLoading} className={cn('w-full flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors', anyLoading && 'opacity-60 cursor-not-allowed')}>
                        <XCircle className="h-4 w-4" /> İptal Et
                      </button>
                    </>
                  )
                })()}
                {selectedAppointment.status === 'pending' && (
                  <>
                    <button onClick={() => updateStatus(selectedAppointment.id, 'confirmed')} className="btn-primary w-full justify-start gap-2">
                      <CheckCircle className="h-4 w-4" /> Onayla
                    </button>
                    <button onClick={(e) => openCancelConfirm(selectedAppointment, e)} className="w-full flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors">
                      <XCircle className="h-4 w-4" /> İptal Et
                    </button>
                  </>
                )}
                {(selectedAppointment.status === 'no_show' || selectedAppointment.status === 'cancelled') && (
                  <>
                    <button onClick={() => updateStatus(selectedAppointment.id, 'confirmed')} className="w-full flex items-center gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm font-medium text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-800/30 transition-colors">
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
                      const today = formatDateISO(new Date())
                      const { error } = await supabase
                        .from('appointments')
                        .update({ status: 'cancelled' })
                        .eq('business_id', businessId!)  // C4: çapraz kiracı koruması — RLS bypass'a karşı savunma
                        .eq('recurrence_group_id', selectedAppointment.recurrence_group_id)
                        .gte('appointment_date', today)
                        .in('status', ['pending', 'confirmed'])
                      if (error) { window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Seri iptal hatası: ' + error.message } })); return }
                      setSelectedAppointment(null)
                      fetchAppointments()
                      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Tüm seri iptal edildi' } }))
                    }}
                    className="w-full flex items-center gap-2 rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50 dark:bg-purple-900/20 px-4 py-2.5 text-sm font-medium text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-800/30 transition-colors"
                  >
                    <Repeat className="h-4 w-4" /> Tüm Seriyi İptal Et
                  </button>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Yeni / Düzenleme Randevu Modal */}
      {showModal && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[115] flex items-center justify-center p-4 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content card w-full max-w-md max-h-[90vh] overflow-y-auto ${isClosingModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-section">
                {editingAppointment ? 'Randevu Düzenle' : 'Yeni Randevu'}
              </h2>
              <button onClick={() => { closeModal(); setEditingAppointment(null) }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="label">{customerLabel}</label>
                <CustomerSearchSelect
                  value={customerId}
                  onChange={v => setCustomerId(v)}
                  businessId={businessId!}
                  placeholder={`${customerLabel} seçin...`}
                />
              </div>
              <div>
                <label className="label">Hizmet</label>
                <CustomSelect
                  options={services.map(s => ({ value: s.id, label: `${s.name} — ${s.duration_minutes} dk${s.price ? ` — ${s.price} TL` : ''}` }))}
                  value={serviceId}
                  onChange={v => {
                    setServiceId(v)
                    const svc = services.find(s => s.id === v)
                    if (svc) setEndTime(calculateEndTime(startTime, svc.duration_minutes))
                    // Seçili personel bu hizmeti yapamıyorsa sıfırla
                    if (staffId && v && !(staffServicesMap[staffId] ?? []).includes(v)) {
                      setStaffId('')
                    }
                  }}
                  placeholder="Hizmet seçin (opsiyonel)..."
                  className="input"
                />
                {intervalWarning && (
                  <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-700 dark:bg-amber-900/20">
                    <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="flex-1 text-amber-900 dark:text-amber-100">
                      <p className="font-medium">Önerilen aralık dolmadı</p>
                      <p className="mt-0.5 text-xs opacity-90">{intervalWarning.message}</p>
                    </div>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Personel</label>
                <CustomSelect
                  options={(() => {
                    // Hizmet seçiliyse: yalnızca o hizmeti yapabilen personeli göster
                    const filtered = serviceId
                      ? staffMembers.filter(s => (staffServicesMap[s.id] ?? []).includes(serviceId))
                      : staffMembers
                    return filtered.map(s => ({ value: s.id, label: s.name }))
                  })()}
                  value={staffId}
                  onChange={v => setStaffId(v)}
                  placeholder={serviceId && staffMembers.filter(s => (staffServicesMap[s.id] ?? []).includes(serviceId)).length === 0
                    ? 'Bu hizmeti yapan personel yok'
                    : 'Personel seçin (opsiyonel)...'}
                  className="input"
                />
                {serviceId && staffMembers.filter(s => (staffServicesMap[s.id] ?? []).includes(serviceId)).length === 0 && (
                  <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
                    Bu hizmeti yapan personel atanmamış. Personel sayfasından hizmet ataması yapın.
                  </p>
                )}
              </div>
              {rooms.length > 0 && (
                <div>
                  <label className="label">Oda</label>
                  <CustomSelect
                    options={[{ value: '', label: '— Oda atama —' }, ...rooms.map(r => ({ value: r.id, label: r.name }))]}
                    value={roomId}
                    onChange={v => setRoomId(v)}
                    className="input"
                  />
                </div>
              )}
              <div>
                <label className="label">Tarih</label>
                <input type="date" value={date} onChange={(e) => {
                  const newDate = e.target.value
                  setDate(newDate)
                  const slots = generateTimeSlots(newDate, workingHours)
                  setStartTime(slots.length > 0 ? slots[0] : '09:00')
                  setEndTime('')
                }} className="input" required />
                {date && workingHours && generateTimeSlots(date, workingHours).length === 0 && (
                  <p className="text-xs text-red-500 mt-1">Bu gün kapalıdır, randevu oluşturulamaz.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Başlangıç</label>
                  <CustomSelect
                    options={generateTimeSlots(date, workingHours).map(t => ({ value: t, label: t }))}
                    value={startTime}
                    onChange={v => {
                      setStartTime(v)
                      // Hizmet seçiliyse bitiş saatini otomatik güncelle
                      const svc = services.find(s => s.id === serviceId)
                      if (svc) setEndTime(calculateEndTime(v, svc.duration_minutes))
                    }}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Bitiş</label>
                  <CustomSelect
                    options={generateTimeSlots(date, workingHours, true).map(t => ({ value: t, label: t }))}
                    value={endTime || calculateEndTime(startTime, services.find(s => s.id === serviceId)?.duration_minutes || 30)}
                    onChange={v => setEndTime(v)}
                    className="input"
                  />
                </div>
              </div>
              {(() => {
                const effectiveEnd = endTime || calculateEndTime(startTime, services.find(s => s.id === serviceId)?.duration_minutes || 30)
                const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
                const durationMin = toMin(effectiveEnd) - toMin(startTime)
                return durationMin > 0 ? (
                  <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 px-4 py-2.5 text-sm text-blue-700 dark:text-blue-300">
                    <Clock className="inline h-3.5 w-3.5 mr-1" />
                    Süre: {Math.floor(durationMin / 60) > 0 ? `${Math.floor(durationMin / 60)} saat ` : ''}{durationMin % 60 > 0 ? `${durationMin % 60} dk` : ''}
                    {serviceId && ` · ${services.find(s => s.id === serviceId)?.name}`}
                  </div>
                ) : null
              })()}
              <div>
                <label className="label">Not (opsiyonel)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder={getAppointmentNotesPlaceholder(sector)} />
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
                            onChange={v => setRecurrenceFrequency(v as 'weekly' | 'biweekly' | 'monthly')}
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
                <button type="button" onClick={() => { closeModal(); setEditingAppointment(null) }} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving || !customerId} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAppointment ? 'Güncelle' : isRecurring ? `${recurrenceCount} Randevu Oluştur` : 'Randevu Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* Erteleme Modal */}
      {(rescheduleAppointment || isClosingReschedule) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[115] flex items-center justify-center p-4 ${isClosingReschedule ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingReschedule) { setRescheduleAppointment(null); setIsClosingReschedule(false) } }}>
          <div className={`modal-content card w-full max-w-sm ${isClosingReschedule ? 'closing' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-section">Randevuyu Ertele</h2>
              <button onClick={() => closeReschedule()} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {rescheduleAppointment?.customers?.name} — {rescheduleAppointment ? formatTime(rescheduleAppointment.start_time) : ''}
            </p>
            <form onSubmit={handleRescheduleSave} className="space-y-4">
              <div>
                <label className="label">Yeni Tarih</label>
                <input type="date" value={rescheduleDate} onChange={(e) => {
                    const newDate = e.target.value
                    setRescheduleDate(newDate)
                    // M3: mevcut saat yeni tarihte de uygunsa koru, değilse ilk slota düş
                    const slots = generateTimeSlots(newDate, workingHours)
                    setRescheduleTime(prev =>
                      slots.includes(prev) ? prev : (slots[0] ?? '09:00')
                    )
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
                <button type="button" onClick={() => closeReschedule()} className="btn-secondary flex-1">Vazgeç</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Ertele
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* İptal Onay Modal */}
      {(cancelConfirmAppointment || isClosingCancelConfirm) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[115] flex items-center justify-center p-4 ${isClosingCancelConfirm ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingCancelConfirm) { setCancelConfirmAppointment(null); setIsClosingCancelConfirm(false) } }}>
          <div className={`modal-content card w-full max-w-sm ${isClosingCancelConfirm ? 'closing' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="h-section">Randevuyu İptal Et</h2>
              <button onClick={() => closeCancelConfirm()} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {cancelConfirmAppointment?.customers?.name} — {cancelConfirmAppointment ? formatTime(cancelConfirmAppointment.start_time) : ''} randevusunu iptal etmek istediğinize emin misiniz?
            </p>
            {(() => {
              const apt = cancelConfirmAppointment
              if (!apt) return null
              const now = new Date()
              const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
              const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
              const isAptPast = apt.appointment_date < todayISO || (apt.appointment_date === todayISO && apt.start_time <= nowTime)
              return (
                <label className={`flex items-center gap-2 mb-3 ${isAptPast ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <input
                    type="checkbox"
                    checked={cancelNotifyCustomer}
                    onChange={(e) => { if (!isAptPast) setCancelNotifyCustomer(e.target.checked) }}
                    disabled={isAptPast}
                    className="rounded border-gray-300 disabled:cursor-not-allowed"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Müşteriye iptal bildirimi gönder
                    {isAptPast && <span className="ml-1 text-xs text-gray-400">(geçmiş randevu — gönderilmez)</span>}
                  </span>
                </label>
              )
            })()}
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 flex items-start gap-1.5">
              <BellRing className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-amber-500" />
              <span>İptal sonrası bekleme listesi otomatik kontrol edilir. Otomatik randevu isteyen müşteri varsa boşluk anında doldurulur, diğerlerine SMS bildirim gider.</span>
            </p>
            <div className="flex gap-3">
              <button type="button" onClick={() => closeCancelConfirm()} className="btn-secondary flex-1">Vazgeç</button>
              <button type="button" onClick={handleCancelConfirm} disabled={saving} className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}İptal Et
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Follow-up quick modal — randevu tamamlandığında otomatik açılır, ya da manuel tetiklenir */}
      {followUpTarget && businessId && (
        <FollowUpQuickModal
          open={!!followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          businessId={businessId}
          customerId={followUpTarget.customerId}
          customerName={followUpTarget.customerName}
          appointmentId={followUpTarget.appointmentId}
          defaultType="post_session"
          defaultDaysOffset={3}
        />
      )}

      {/* Hızlı tahsilat — kasaya gitmeden randevu üzerinden tahsilat al */}
      {quickPaymentTarget && (
        <QuickPaymentModal
          open={!!quickPaymentTarget}
          onClose={() => setQuickPaymentTarget(null)}
          appointment={quickPaymentTarget}
          staffId={currentStaffId}
          onCreated={() => fetchAppointments()}
        />
      )}
    </div>
  )
}

// ── Aksiyon butonları — modül seviyesinde (sayfa içinde tanımlanırsa 1sn interval render'ı
//    sebebiyle her saniye remount olur, hover state sıfırlanır). ──
interface ActionButtonsProps {
  apt: AppointmentView
  size?: 'sm' | 'md'
  todayStr: string
  fillGapLoading: string | null
  statusLoadingAction?: { id: string; status: AppointmentStatus } | null
  onEdit: (apt: AppointmentView, e: React.MouseEvent) => void
  onReschedule: (apt: AppointmentView, e: React.MouseEvent) => void
  onUpdateStatus: (id: string, status: AppointmentStatus, e?: React.MouseEvent) => void
  onCancelConfirm: (apt: AppointmentView, e: React.MouseEvent) => void
  onFillGap: (id: string, e: React.MouseEvent) => void
  onDelete: (id: string, e?: React.MouseEvent) => void
  onQuickPayment: (apt: AppointmentView) => void
  onFollowUp: (target: { appointmentId: string; customerId: string; customerName: string }) => void
}

function ActionButtons({
  apt, size = 'md', todayStr, fillGapLoading, statusLoadingAction,
  onEdit, onReschedule, onUpdateStatus, onCancelConfirm,
  onFillGap, onDelete, onQuickPayment, onFollowUp,
}: ActionButtonsProps) {
  const isLoadingAction = (status: AppointmentStatus) =>
    statusLoadingAction?.id === apt.id && statusLoadingAction.status === status
  const isAnyLoading = statusLoadingAction?.id === apt.id
  const btnCls = size === 'sm'
    ? 'flex h-7 w-7 items-center justify-center rounded-lg transition-colors'
    : 'flex h-8 w-8 items-center justify-center rounded-lg transition-colors'
  const iconCls = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  // Tarih geçmişse VEYA bugün ama saat geçmişse → eski slot — doldurulamaz
  const _now = new Date()
  const nowTimeStr = `${String(_now.getHours()).padStart(2, '0')}:${String(_now.getMinutes()).padStart(2, '0')}`
  const isPastApt = apt.appointment_date < todayStr ||
    (apt.appointment_date === todayStr && apt.start_time <= nowTimeStr)

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {(apt.status === 'confirmed' || apt.status === 'pending') && (
        <>
          <button onClick={(e) => onEdit(apt, e)} title="Düzenle" className={cn(btnCls, 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700')}>
            <Pencil className={iconCls} />
          </button>
          <button onClick={(e) => onReschedule(apt, e)} title="Ertele" className={cn(btnCls, 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30')}>
            <CalendarClock className={iconCls} />
          </button>
        </>
      )}
      {apt.status === 'confirmed' && (
        <>
          <button onClick={(e) => onUpdateStatus(apt.id, 'completed', e)} title="Tamamlandı" disabled={isAnyLoading} className={cn(btnCls, 'text-green-500 hover:bg-green-50 dark:hover:bg-green-900/30', isAnyLoading && 'opacity-60 cursor-not-allowed')}>
            {isLoadingAction('completed')
              ? <Loader2 className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', 'animate-spin')} />
              : <CheckCircle className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />}
          </button>
          <button onClick={(e) => onUpdateStatus(apt.id, 'no_show', e)} title="Gelmedi" disabled={isAnyLoading} className={cn(btnCls, 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30', isAnyLoading && 'opacity-60 cursor-not-allowed')}>
            {isLoadingAction('no_show')
              ? <Loader2 className={cn(size === 'sm' ? 'h-4 w-4' : 'h-5 w-5', 'animate-spin')} />
              : <AlertTriangle className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />}
          </button>
          <button onClick={(e) => onCancelConfirm(apt, e)} title="İptal" disabled={isAnyLoading} className={cn(btnCls, 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700', isAnyLoading && 'opacity-60 cursor-not-allowed')}>
            <XCircle className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
          </button>
        </>
      )}
      {apt.status === 'completed' && (() => {
        const isPackageSession = !!apt.customer_package_id
        const invs = Array.isArray(apt.invoices) ? apt.invoices : []
        const isAlreadyPaid = invs.some(i => i.status === 'paid' || (i.paid_amount ?? 0) > 0)
        const paymentLocked = isPackageSession || isAlreadyPaid
        return (
          <>
            {!paymentLocked && (
              <button
                onClick={(e) => { e.stopPropagation(); onQuickPayment(apt) }}
                title="Tahsilat Al"
                className={cn(btnCls, 'text-pulse-700 dark:text-pulse-300 hover:bg-pulse-50 dark:hover:bg-pulse-900/30')}
              >
                <Wallet className={iconCls} />
              </button>
            )}
            {apt.customer_id && apt.customers?.name && (
              <button
                onClick={(e) => { e.stopPropagation(); onFollowUp({ appointmentId: apt.id, customerId: apt.customer_id!, customerName: apt.customers!.name }) }}
                title="Takip Başlat"
                className={cn(btnCls, 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30')}
              >
                <BellRing className={iconCls} />
              </button>
            )}
          </>
        )
      })()}
      {(apt.status === 'no_show' || apt.status === 'cancelled') && (
        <>
          {/* Boşluğu Doldur: yalnızca gelecek/bugün iptalleri için — geçmiş slotları doldurmak anlamsız */}
          {apt.status === 'cancelled' && !isPastApt && (
            <button
              onClick={(e) => onFillGap(apt.id, e)}
              title="Boşluğu Doldur — Uygun müşterilere bildirim gönder"
              disabled={fillGapLoading === apt.id}
              className={cn(btnCls, 'text-purple-600 dark:text-purple-400 bg-purple-50/60 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/40')}
            >
              {fillGapLoading === apt.id
                ? <Loader2 className={cn(iconCls, 'animate-spin')} />
                : <BellRing className={iconCls} />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, 'confirmed') }}
            className={cn(
              'flex items-center gap-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 font-medium text-blue-700 dark:text-blue-300 transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40',
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-8 px-3 text-sm'
            )}
          >
            <CheckCircle className={iconCls} /> Aktif Et
          </button>
          <button
            onClick={(e) => onDelete(apt.id, e)}
            title="Sil"
            className={cn(btnCls, 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30')}
          >
            <Trash2 className={iconCls} />
          </button>
        </>
      )}
      {apt.status === 'pending' && (
        <button
          onClick={(e) => { e.stopPropagation(); onUpdateStatus(apt.id, 'confirmed') }}
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

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-0.5 flex-shrink-0">{label}</span>
      <span className="text-sm text-gray-900 dark:text-gray-100 text-right">{value}</span>
    </div>
  )
}

// ── Durum filtre chip'i — kompakt, tek satır ──
function StatusChip({
  label,
  count,
  active,
  tone,
  onClick,
}: {
  label: string
  count: number
  active: boolean
  tone: 'info' | 'success' | 'danger' | 'warning'
  onClick: () => void
}) {
  // M5: pasif + sıfır sayaçlı chip'i gizle — boş "0 Gelmedi" yer kaplamasın
  if (count === 0 && !active) return null
  const activeClasses = {
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    success: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    danger: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  }
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? activeClasses[tone]
          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800',
      )}
    >
      <span>{label}</span>
      <span className="tabular-nums text-[11px] font-semibold opacity-80">{count}</span>
    </button>
  )
}
