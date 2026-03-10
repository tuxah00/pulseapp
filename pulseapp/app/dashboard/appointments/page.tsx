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
} from 'lucide-react'
import { formatTime, formatDate, getStatusColor, formatCurrency, cn } from '@/lib/utils'
import { STATUS_LABELS, type AppointmentStatus, type Customer, type Service, type StaffMember } from '@/types'

export default function AppointmentsPage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [now, setNow] = useState(new Date())
  const [viewMode, setViewMode] = useViewMode('appointments', 'list')
  const [selectedAppointment, setSelectedAppointment] = useState<any | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any | null>(null)
  const [cancelConfirmAppointment, setCancelConfirmAppointment] = useState<any | null>(null)
  const [cancelNotifyCustomer, setCancelNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('09:00')

  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  const [customerId, setCustomerId] = useState('')
  const [serviceId, setServiceId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('09:00')
  const [notes, setNotes] = useState('')

  const supabase = createClient()

  const fetchAppointments = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const { data, error } = await supabase
      .from('appointments')
      .select('*, customers(name, phone), services(name, duration_minutes, price), staff_members(name)')
      .eq('business_id', businessId)
      .eq('appointment_date', selectedDate)
      .order('start_time', { ascending: true })

    if (data) setAppointments(data)
    if (error) console.error('Randevu çekme hatası:', error)
    setLoading(false)
  }, [selectedDate, businessId])

  const fetchFormData = useCallback(async () => {
    if (!businessId) return
    const [custRes, svcRes, staffRes] = await Promise.all([
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order'),
      supabase.from('staff_members').select('*').eq('business_id', businessId).eq('is_active', true).order('name'),
    ])
    if (custRes.data) setCustomers(custRes.data)
    if (svcRes.data) setServices(svcRes.data)
    if (staffRes.data) setStaffMembers(staffRes.data)
  }, [businessId])

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { if (!ctxLoading) fetchAppointments() }, [fetchAppointments, ctxLoading])
  useEffect(() => { if (!ctxLoading) fetchFormData() }, [fetchFormData, ctxLoading])

  function changeDate(days: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function goToday() { setSelectedDate(new Date().toISOString().split('T')[0]) }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = selectedDate === todayStr
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

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

  function openNewModal() {
    setEditingAppointment(null)
    setCustomerId(''); setServiceId(''); setStaffId('')
    setDate(selectedDate); setStartTime('09:00'); setNotes('')
    setError(null); setShowModal(true)
  }

  function openEditModal(apt: any, e?: React.MouseEvent) {
    e?.stopPropagation()
    setEditingAppointment(apt)
    setCustomerId(apt.customer_id); setServiceId(apt.service_id || ''); setStaffId(apt.staff_id || '')
    setDate(apt.appointment_date); setStartTime(apt.start_time); setNotes(apt.notes || '')
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
    } else {
      const { error } = await supabase.from('appointments').insert({ business_id: businessId, ...payload, status: 'confirmed', source: 'manual' })
      if (error) { setError(error.message.includes('başka bir randevusu var') ? 'Bu personelin bu saatte başka bir randevusu var.' : error.message); setSaving(false); return }
    }
    setSaving(false); setShowModal(false); fetchAppointments()
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
    setSaving(false); setCancelConfirmAppointment(null)
    if (selectedAppointment?.id === apt.id) setSelectedAppointment(null)
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
    fetchAppointments()
  }

  function generateTimeSlots() {
    const slots = []
    for (let h = 8; h <= 21; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }

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
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Randevular</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{totalCount} randevu</p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />Yeni Randevu
        </button>
      </div>

      {/* Tarih Navigasyonu */}
      <div className="mb-6 card p-4 flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">{formatSelectedDate()}</p>
          {!isToday && (
            <button onClick={goToday} className="text-sm text-pulse-600 hover:text-pulse-700 mt-0.5">Bugüne Dön</button>
          )}
          {isToday && <p className="text-sm text-pulse-600 mt-0.5">Bugün</p>}
        </div>
        <button onClick={() => changeDate(1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Şu anki saat */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center rounded-full bg-gray-200/90 dark:bg-gray-700/90 px-5 py-2 text-base font-semibold text-gray-800 dark:text-gray-100 shadow-sm">
          Şu an:{' '}
          <span className="ml-1 tabular-nums">
            {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>

      {/* Mini İstatistik + Görünüm butonları */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid flex-1 grid-cols-4 gap-3">
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCount}</p><p className="text-xs text-gray-500">Toplam</p></div>
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-blue-600">{confirmedCount}</p><p className="text-xs text-gray-500">Onaylı</p></div>
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-green-600">{completedCount}</p><p className="text-xs text-gray-500">Tamamlandı</p></div>
          <div className="card p-3 text-center"><p className="text-2xl font-bold text-red-600">{noShowCount}</p><p className="text-xs text-gray-500">Gelmedi</p></div>
        </div>
        <div className="flex justify-end">
          <div className="inline-flex rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs transition-colors', viewMode === 'list' ? 'bg-pulse-50 text-pulse-700 dark:bg-pulse-900/40 dark:text-pulse-300' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700')}
              title="Liste görünüm"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('box')}
              className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs transition-colors', viewMode === 'box' ? 'bg-pulse-50 text-pulse-700 dark:bg-pulse-900/40 dark:text-pulse-300' : 'text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700')}
              title="Kutu görünüm"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Randevu Listesi */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
        </div>
      ) : appointments.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Calendar className="mb-4 h-12 w-12 text-gray-300" />
          <p className="mb-4 text-gray-500">Bu tarihte randevu yok</p>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />Randevu Ekle
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const timeState = getTimeState(apt)
            return (
              <div
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  'card p-4 transition-all cursor-pointer hover:shadow-md',
                  timeState === 'past' && 'border-transparent bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                  timeState === 'current' && 'border-green-500 ring-2 ring-green-400 bg-white dark:bg-gray-800',
                  selectedAppointment?.id === apt.id && 'ring-2 ring-pulse-500',
                )}
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 flex-shrink-0 text-center">
                    <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatTime(apt.start_time)}</p>
                    <p className="text-xs text-gray-400">{formatTime(apt.end_time)}</p>
                  </div>
                  <div className="h-12 w-px flex-shrink-0 bg-gray-200 dark:bg-gray-600" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{apt.customers?.name || 'İsimsiz'}</span>
                      <span className={`badge ${getStatusColor(apt.status)}`}>{STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                      {apt.services?.name && <span>{apt.services.name}</span>}
                      {apt.staff_members?.name && <span>· {apt.staff_members.name}</span>}
                    </div>
                    {apt.notes && <p className="mt-1 truncate text-sm text-gray-400">{apt.notes}</p>}
                  </div>
                  <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <ActionButtons apt={apt} size="md" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {appointments.map((apt) => {
            const timeState = getTimeState(apt)
            return (
              <div
                key={apt.id}
                onClick={() => setSelectedAppointment(apt)}
                className={cn(
                  'card flex aspect-square flex-col justify-between p-4 transition-all cursor-pointer hover:shadow-md',
                  timeState === 'past' && 'border-transparent bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300',
                  timeState === 'current' && 'border-green-500 ring-2 ring-green-400 bg-white dark:bg-gray-800',
                  selectedAppointment?.id === apt.id && 'ring-2 ring-pulse-500',
                )}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{formatTime(apt.start_time)}</div>
                  <span className={`badge ${getStatusColor(apt.status)}`}>{STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}</span>
                </div>

                <div className="mt-3 min-h-[5rem] flex flex-col justify-center space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                  <p className="font-medium text-gray-900 dark:text-gray-100 truncate">{apt.customers?.name || 'İsimsiz'}</p>
                  <p className="text-gray-500 dark:text-gray-400">{formatTime(apt.start_time)} – {formatTime(apt.end_time)}</p>
                  <p className="truncate">{apt.services?.name ? `Hizmet: ${apt.services.name}` : '—'}</p>
                  <p className="truncate">{apt.staff_members?.name ? `Personel: ${apt.staff_members.name}` : '—'}</p>
                  <p>Ücret: <span className="text-price">{formatCurrency(apt.services?.price ?? 0)}</span></p>
                  <p className={cn('truncate text-gray-400', !apt.notes && 'invisible')}>{apt.notes || '—'}</p>
                </div>

                <div className="mt-4 flex items-center justify-end" onClick={(e) => e.stopPropagation()}>
                  <ActionButtons apt={apt} size="sm" />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detay Slide-Over Paneli ── */}
      {selectedAppointment && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={() => setSelectedAppointment(null)} />
          <div className="slide-panel border-l border-gray-200 dark:border-gray-700">
            {/* Panel başlık */}
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Randevu Detayı</h3>
              <button onClick={() => setSelectedAppointment(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Panel içerik */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Durum + Saat */}
              <div className="flex flex-col items-center gap-2 py-4">
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{formatTime(selectedAppointment.start_time)}</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">{formatTime(selectedAppointment.start_time)} – {formatTime(selectedAppointment.end_time)}</p>
                <span className={`badge ${getStatusColor(selectedAppointment.status)}`}>
                  {STATUS_LABELS[selectedAppointment.status as keyof typeof STATUS_LABELS]}
                </span>
              </div>

              {/* Bilgiler */}
              <div className="space-y-3">
                <DetailRow label="Müşteri" value={selectedAppointment.customers?.name || 'İsimsiz'} />
                {selectedAppointment.customers?.phone && (
                  <DetailRow label="Telefon" value={
                    <a href={`tel:${selectedAppointment.customers.phone}`} className="text-pulse-600 hover:underline flex items-center gap-1">
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
                {selectedAppointment.status === 'confirmed' && (
                  <>
                    <button onClick={() => { updateStatus(selectedAppointment.id, 'completed'); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 px-4 py-2.5 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-800/30 transition-colors">
                      <CheckCircle className="h-4 w-4" /> Tamamlandı İşaretle
                    </button>
                    <button onClick={() => { updateStatus(selectedAppointment.id, 'no_show'); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 px-4 py-2.5 text-sm font-medium text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-800/30 transition-colors">
                      <AlertTriangle className="h-4 w-4" /> Gelmedi İşaretle
                    </button>
                    <button onClick={(e) => { openCancelConfirm(selectedAppointment, e); setSelectedAppointment(null) }} className="w-full flex items-center gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-medium text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-800/30 transition-colors">
                      <XCircle className="h-4 w-4" /> İptal Et
                    </button>
                  </>
                )}
                {selectedAppointment.status === 'pending' && (
                  <button onClick={() => { updateStatus(selectedAppointment.id, 'confirmed'); setSelectedAppointment(null) }} className="btn-primary w-full justify-start gap-2">
                    <CheckCircle className="h-4 w-4" /> Onayla
                  </button>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Yeni / Düzenleme Randevu Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
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
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input" required>
                  <option value="">Müşteri seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
                {customers.length === 0 && <p className="text-xs text-amber-600 mt-1">Önce müşteri eklemelisiniz.</p>}
              </div>
              <div>
                <label className="label">Hizmet</label>
                <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
                  <option value="">Hizmet seçin (opsiyonel)...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} dk{s.price ? ` — ${s.price} TL` : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Personel</label>
                <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input">
                  <option value="">Personel seçin (opsiyonel)...</option>
                  {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tarih</label>
                  <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input" required />
                </div>
                <div>
                  <label className="label">Saat</label>
                  <select value={startTime} onChange={(e) => setStartTime(e.target.value)} className="input" required>
                    {generateTimeSlots().map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
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
              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowModal(false); setEditingAppointment(null) }} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving || !customerId} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingAppointment ? 'Güncelle' : 'Randevu Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Erteleme Modal */}
      {rescheduleAppointment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm">
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
                <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} className="input" required />
              </div>
              <div>
                <label className="label">Yeni Saat</label>
                <select value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} className="input" required>
                  {generateTimeSlots().map(t => <option key={t} value={t}>{t}</option>)}
                </select>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Randevuyu İptal Et</h2>
              <button onClick={() => setCancelConfirmAppointment(null)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {cancelConfirmAppointment.customers?.name} — {formatTime(cancelConfirmAppointment.start_time)} randevusunu iptal etmek istediğinize emin misiniz?
            </p>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input type="checkbox" checked={cancelNotifyCustomer} onChange={(e) => setCancelNotifyCustomer(e.target.checked)} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Müşteriye WhatsApp ile iptal bildirimi gönder</span>
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
