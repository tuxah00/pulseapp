'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Plus,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  CheckCircle,
  XCircle,
  AlertTriangle,
  X,
  Pencil,
  CalendarClock,
  LayoutList,
  LayoutGrid,
} from 'lucide-react'
import { formatTime, getStatusColor, cn } from '@/lib/utils'
import { STATUS_LABELS, type Appointment, type AppointmentStatus, type Customer, type Service, type StaffMember } from '@/types'

export default function AppointmentsPage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [now, setNow] = useState(new Date())
  const [viewMode, setViewMode] = useState<'list' | 'box'>('list')
  const [showModal, setShowModal] = useState(false)
  const [editingAppointment, setEditingAppointment] = useState<any | null>(null)
  const [rescheduleAppointment, setRescheduleAppointment] = useState<any | null>(null)
  const [cancelConfirmAppointment, setCancelConfirmAppointment] = useState<any | null>(null)
  const [cancelNotifyCustomer, setCancelNotifyCustomer] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rescheduleDate, setRescheduleDate] = useState('')
  const [rescheduleTime, setRescheduleTime] = useState('09:00')

  // Dropdown data
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])

  // Form state
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

  // Şu anki zamanı düzenli olarak güncelle
  useEffect(() => {
    // Daha akıcı ve sistem saatine daha yakın görünmesi için saniyede bir güncelle
    const id = setInterval(() => setNow(new Date()), 1_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { if (!ctxLoading) fetchAppointments() }, [fetchAppointments, ctxLoading])
  useEffect(() => { if (!ctxLoading) fetchFormData() }, [fetchFormData, ctxLoading])

  // Tarih navigasyonu
  function changeDate(days: number) {
    const d = new Date(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(d.toISOString().split('T')[0])
  }

  function goToday() {
    setSelectedDate(new Date().toISOString().split('T')[0])
  }

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const isToday = selectedDate === todayStr
  const nowMinutes = now.getHours() * 60 + now.getMinutes()

  function getTimeState(apt: any): 'past' | 'current' | 'future' {
    // Seçili gün bugünden önce ise: tüm randevular geçmiş (gri)
    if (selectedDate < todayStr) return 'past'
    // Seçili gün bugünden sonraysa: tüm randevular gelecek (beyaz)
    if (selectedDate > todayStr) return 'future'
    // Bugün ise: saat bazlı durum hesapla
    const toMinutes = (time: string) => {
      const [h, m] = time.split(':').map(Number)
      return h * 60 + m
    }
    const start = toMinutes(apt.start_time)
    const end = toMinutes(apt.end_time)
    if (end <= nowMinutes) return 'past'
    if (start <= nowMinutes && nowMinutes < end) return 'current'
    return 'future'
  }

  // Tarih formatla
  function formatSelectedDate() {
    const d = new Date(selectedDate + 'T00:00:00')
    const days = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi']
    const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}, ${days[d.getDay()]}`
  }

  // Modal aç (yeni)
  function openNewModal() {
    setEditingAppointment(null)
    setCustomerId(''); setServiceId(''); setStaffId('')
    setDate(selectedDate); setStartTime('09:00'); setNotes('')
    setError(null); setShowModal(true)
  }

  // Düzenleme modalı aç
  function openEditModal(apt: any) {
    setEditingAppointment(apt)
    setCustomerId(apt.customer_id); setServiceId(apt.service_id || ''); setStaffId(apt.staff_id || '')
    setDate(apt.appointment_date); setStartTime(apt.start_time); setNotes(apt.notes || '')
    setError(null); setShowModal(true)
  }

  // Erteleme modalı aç
  function openRescheduleModal(apt: any) {
    setRescheduleAppointment(apt)
    setRescheduleDate(apt.appointment_date)
    setRescheduleTime(apt.start_time)
    setError(null)
  }

  // İptal onay modalı aç
  function openCancelConfirm(apt: any) {
    setCancelConfirmAppointment(apt)
    setCancelNotifyCustomer(true)
  }

  // Bitiş saati hesapla
  function calculateEndTime(start: string, durationMinutes: number): string {
    const [h, m] = start.split(':').map(Number)
    const totalMin = h * 60 + m + durationMinutes
    const endH = Math.floor(totalMin / 60)
    const endM = totalMin % 60
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  // Kaydet (yeni veya düzenleme)
  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError(null)

    const selectedService = services.find(s => s.id === serviceId)
    const duration = selectedService?.duration_minutes || 30
    const endTime = calculateEndTime(startTime, duration)

    const payload = {
      customer_id: customerId,
      service_id: serviceId || null,
      staff_id: staffId || null,
      appointment_date: date,
      start_time: startTime,
      end_time: endTime,
      notes: notes || null,
    }

    if (editingAppointment) {
      const { error } = await supabase
        .from('appointments')
        .update(payload)
        .eq('id', editingAppointment.id)

      if (error) {
        if (error.message.includes('başka bir randevusu var')) {
          setError('Bu personelin bu saatte başka bir randevusu var.')
        } else {
          setError(error.message)
        }
        setSaving(false)
        return
      }
      setEditingAppointment(null)
    } else {
      const { error } = await supabase.from('appointments').insert({
        business_id: businessId,
        ...payload,
        status: 'confirmed',
        source: 'manual',
      })

      if (error) {
        if (error.message.includes('başka bir randevusu var')) {
          setError('Bu personelin bu saatte başka bir randevusu var.')
        } else {
          setError(error.message)
        }
        setSaving(false)
        return
      }
    }

    setSaving(false); setShowModal(false); fetchAppointments()
  }

  // Erteleme kaydet
  async function handleRescheduleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!rescheduleAppointment) return
    setSaving(true); setError(null)
    const selectedService = services.find(s => s.id === rescheduleAppointment.service_id)
    const duration = selectedService?.duration_minutes || 30
    const endTime = calculateEndTime(rescheduleTime, duration)

    const { error } = await supabase
      .from('appointments')
      .update({
        appointment_date: rescheduleDate,
        start_time: rescheduleTime,
        end_time: endTime,
      })
      .eq('id', rescheduleAppointment.id)

    if (error) {
      if (error.message.includes('başka bir randevusu var')) {
        setError('Bu personelin bu saatte başka bir randevusu var.')
      } else {
        setError(error.message)
      }
      setSaving(false)
      return
    }
    setSaving(false); setRescheduleAppointment(null); fetchAppointments()
  }

  // İptal onayı (isteğe bağlı WhatsApp bildirimi)
  async function handleCancelConfirm() {
    if (!cancelConfirmAppointment) return
    setSaving(true)
    const apt = cancelConfirmAppointment
    const { error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' })
      .eq('id', apt.id)

    if (error) {
      alert('İptal güncellenemedi: ' + error.message)
      setSaving(false)
      setCancelConfirmAppointment(null)
      return
    }

    if (cancelNotifyCustomer && apt.customer_id) {
      try {
        await fetch('/api/messages/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            businessId,
            customerId: apt.customer_id,
            content: 'Merhaba, randevunuz iptal edilmiştir. Sorularınız için bizi arayabilirsiniz.',
          }),
        })
      } catch {
        // Bildirim hatası randevu iptalini geri almaz
      }
    }
    setSaving(false); setCancelConfirmAppointment(null); fetchAppointments()
  }

  // Durum güncelle
  async function updateStatus(appointmentId: string, newStatus: AppointmentStatus) {
    const { error } = await supabase
      .from('appointments')
      .update({ status: newStatus })
      .eq('id', appointmentId)

    if (error) {
      const isSegmentError = error.message.includes('segment') && error.message.includes('customer_segment')
      if (isSegmentError) {
        alert(
          'Randevu güncellemesi veritabanı ayarı nedeniyle başarısız.\n\n' +
          'Düzeltmek için:\n' +
          '1. Supabase Dashboard → SQL Editor\'ü açın.\n' +
          '2. Projedeki supabase/migrations/003_fix_appointment_customer_segment.sql dosyasının tüm içeriğini kopyalayıp SQL Editor\'e yapıştırın.\n' +
          '3. "Run" ile çalıştırın.\n' +
          '4. Bu sayfayı yenileyip tekrar deneyin.'
        )
      } else {
        alert('Güncelleme hatası: ' + error.message)
      }
      return
    }
    fetchAppointments()
  }

  // Saat slotları oluştur
  function generateTimeSlots() {
    const slots = []
    for (let h = 8; h <= 21; h++) {
      slots.push(`${String(h).padStart(2, '0')}:00`)
      slots.push(`${String(h).padStart(2, '0')}:30`)
    }
    return slots
  }

  // İstatistikler
  const totalCount = appointments.length
  const confirmedCount = appointments.filter(a => a.status === 'confirmed').length
  const completedCount = appointments.filter(a => a.status === 'completed').length
  const noShowCount = appointments.filter(a => a.status === 'no_show').length

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Randevular</h1>
          <p className="mt-1 text-sm text-gray-500">{totalCount} randevu</p>
        </div>
        <button onClick={openNewModal} className="btn-primary">
          <Plus className="mr-2 h-4 w-4" />Yeni Randevu
        </button>
      </div>

      {/* Tarih Navigasyonu */}
      <div className="mb-6 card p-4 flex items-center justify-between">
        <button onClick={() => changeDate(-1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"><ChevronLeft className="h-5 w-5" /></button>
        <div className="text-center">
          <p className="text-lg font-semibold text-gray-900">{formatSelectedDate()}</p>
          {!isToday && (
            <button onClick={goToday} className="text-sm text-pulse-600 hover:text-pulse-700 mt-0.5">Bugüne Dön</button>
          )}
          {isToday && <p className="text-sm text-pulse-600 mt-0.5">Bugün</p>}
        </div>
        <button onClick={() => changeDate(1)} className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100"><ChevronRight className="h-5 w-5" /></button>
      </div>

      {/* Şu anki saat */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center rounded-full bg-gray-200/90 px-5 py-2 text-base font-semibold text-gray-800 shadow-sm">
          <span>
            Şu an:{' '}
            <span className="tabular-nums">
              {now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </span>
        </div>
      </div>

      {/* Mini İstatistik + Görünüm butonları */}
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="grid flex-1 grid-cols-4 gap-3">
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-gray-900">{totalCount}</p>
            <p className="text-xs text-gray-500">Toplam</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-blue-600">{confirmedCount}</p>
            <p className="text-xs text-gray-500">Onaylı</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{completedCount}</p>
            <p className="text-xs text-gray-500">Tamamlandı</p>
          </div>
          <div className="card p-3 text-center">
            <p className="text-2xl font-bold text-red-600">{noShowCount}</p>
            <p className="text-xs text-gray-500">Gelmedi</p>
          </div>
        </div>
        {/* 1 numaralı alan: görünüm geçiş butonları */}
        <div className="flex justify-end md:w-auto">
          <div className="inline-flex rounded-full border border-gray-200 bg-white p-0.5 shadow-sm">
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs transition-colors',
                viewMode === 'list'
                  ? 'bg-pulse-50 text-pulse-700'
                  : 'text-gray-500 hover:bg-gray-50',
              )}
              title="Liste görünüm"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('box')}
              className={cn(
                'inline-flex items-center rounded-full px-2.5 py-1 text-xs transition-colors',
                viewMode === 'box'
                  ? 'bg-pulse-50 text-pulse-700'
                  : 'text-gray-500 hover:bg-gray-50',
              )}
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
            <Plus className="mr-2 h-4 w-4" />
            Randevu Ekle
          </button>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-3">
          {appointments.map((apt) => {
            const timeState = getTimeState(apt)
            const cardClass = cn(
              'card p-4 transition-colors',
              // Süresi geçen randevular: tamamen gri kutu
              timeState === 'past' && 'border-transparent bg-gray-200 text-gray-700',
              // Şu anki randevu: beyaz zemin, sadece yeşil çerçeve
              timeState === 'current' && 'border-green-500 ring-2 ring-green-400 bg-white',
            )

            return (
              <div key={apt.id} className={cardClass}>
                <div className="flex items-center gap-4">
                  {/* Saat */}
                  <div className="w-16 flex-shrink-0 text-center">
                    <p className="text-lg font-bold text-gray-900">{formatTime(apt.start_time)}</p>
                    <p className="text-xs text-gray-400">{formatTime(apt.end_time)}</p>
                  </div>

                  {/* Dikey çizgi */}
                  <div className="h-12 w-px flex-shrink-0 bg-gray-200" />

                  {/* Detaylar */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">
                        {apt.customers?.name || 'İsimsiz'}
                      </span>
                      <span className={`badge ${getStatusColor(apt.status)}`}>
                        {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-sm text-gray-500">
                      {apt.services?.name && <span>{apt.services.name}</span>}
                      {apt.staff_members?.name && <span>· {apt.staff_members.name}</span>}
                      {apt.services?.duration_minutes && (
                        <span>· {apt.services.duration_minutes} dk</span>
                      )}
                    </div>
                    {apt.notes && (
                      <p className="mt-1 truncate text-sm text-gray-400">{apt.notes}</p>
                    )}
                  </div>

                  {/* İkonlar: Düzenle, Ertele, Tamamlandı, Gelmedi, İptal */}
                  <div className="flex flex-shrink-0 items-center gap-1">
                    {(apt.status === 'confirmed' || apt.status === 'pending') && (
                      <>
                        <button
                          onClick={() => openEditModal(apt)}
                          title="Düzenle"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openRescheduleModal(apt)}
                          title="Ertele"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-blue-500 transition-colors hover:bg-blue-50"
                        >
                          <CalendarClock className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => updateStatus(apt.id, 'completed')}
                          title="Tamamlandı"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-green-500 transition-colors hover:bg-green-50"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'no_show')}
                          title="Gelmedi"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                        >
                          <AlertTriangle className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openCancelConfirm(apt)}
                          title="İptal"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100"
                        >
                          <XCircle className="h-5 w-5" />
                        </button>
                      </>
                    )}
                    {apt.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'confirmed')}
                        title="Onayla"
                        className="flex h-8 items-center gap-1 rounded-lg bg-blue-50 px-3 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        <CheckCircle className="h-4 w-4" /> Onayla
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        // Kutulu görünüm (box view)
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {appointments.map((apt) => {
            const timeState = getTimeState(apt)
            const cardClass = cn(
              'card flex aspect-square flex-col justify-between p-4 transition-colors',
              // Süresi geçen randevular: tamamen gri kutu
              timeState === 'past' && 'border-transparent bg-gray-200 text-gray-700',
              // Şu anki randevu: beyaz zemin, sadece yeşil çerçeve
              timeState === 'current' && 'border-green-500 ring-2 ring-green-400 bg-white',
            )

            return (
              <div key={apt.id} className={cardClass}>
                {/* Üst: başlangıç saati ve durum (ortalanmış) */}
                <div className="flex flex-col items-center gap-1">
                  <div className="text-2xl font-semibold text-gray-900">
                    {formatTime(apt.start_time)}
                  </div>
                  <span className={`badge ${getStatusColor(apt.status)}`}>
                    {STATUS_LABELS[apt.status as keyof typeof STATUS_LABELS]}
                  </span>
                </div>

                {/* Orta: müşteri ve detaylar */}
                <div className="mt-3 space-y-1 text-xs text-gray-600">
                  <p className="font-medium text-gray-900">
                    {apt.customers?.name || 'İsimsiz'}
                  </p>
                  <p className="text-gray-500">
                    {formatTime(apt.start_time)} – {formatTime(apt.end_time)}
                  </p>
                  {apt.services?.name && <p>Hizmet: {apt.services.name}</p>}
                  {apt.staff_members?.name && <p>Personel: {apt.staff_members.name}</p>}
                  {apt.services?.duration_minutes && <p>Süre: {apt.services.duration_minutes} dk</p>}
                  {apt.notes && <p className="truncate text-gray-400">{apt.notes}</p>}
                </div>

                {/* Alt: aksiyon ikonları */}
                <div className="mt-4 flex items-center justify-end">
                  <div className="flex items-center gap-1">
                    {(apt.status === 'confirmed' || apt.status === 'pending') && (
                      <>
                        <button
                          onClick={() => openEditModal(apt)}
                          title="Düzenle"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => openRescheduleModal(apt)}
                          title="Ertele"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-blue-500 transition-colors hover:bg-blue-50"
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                    {apt.status === 'confirmed' && (
                      <>
                        <button
                          onClick={() => updateStatus(apt.id, 'completed')}
                          title="Tamamlandı"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-green-500 transition-colors hover:bg-green-50"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateStatus(apt.id, 'no_show')}
                          title="Gelmedi"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50"
                        >
                          <AlertTriangle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openCancelConfirm(apt)}
                          title="İptal"
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    {apt.status === 'pending' && (
                      <button
                        onClick={() => updateStatus(apt.id, 'confirmed')}
                        title="Onayla"
                        className="flex h-7 items-center gap-1 rounded-lg bg-blue-50 px-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                      >
                        <CheckCircle className="h-3.5 w-3.5" /> Onayla
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Yeni / Düzenleme Randevu Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editingAppointment ? 'Randevu Düzenle' : 'Yeni Randevu'}
              </h2>
              <button
                onClick={() => { setShowModal(false); setEditingAppointment(null) }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              {/* Müşteri */}
              <div>
                <label className="label">Müşteri</label>
                <select value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="input" required>
                  <option value="">Müşteri seçin...</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
                {customers.length === 0 && <p className="text-xs text-amber-600 mt-1">Önce müşteri eklemelisiniz.</p>}
              </div>

              {/* Hizmet */}
              <div>
                <label className="label">Hizmet</label>
                <select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="input">
                  <option value="">Hizmet seçin (opsiyonel)...</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name} — {s.duration_minutes} dk{s.price ? ` — ${s.price} TL` : ''}</option>)}
                </select>
              </div>

              {/* Personel */}
              <div>
                <label className="label">Personel</label>
                <select value={staffId} onChange={(e) => setStaffId(e.target.value)} className="input">
                  <option value="">Personel seçin (opsiyonel)...</option>
                  {staffMembers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              {/* Tarih ve Saat */}
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

              {/* Seçili hizmetin süresi */}
              {serviceId && (
                <div className="rounded-lg bg-blue-50 px-4 py-2.5 text-sm text-blue-700">
                  <Clock className="inline h-3.5 w-3.5 mr-1" />
                  Bitiş: {calculateEndTime(startTime, services.find(s => s.id === serviceId)?.duration_minutes || 30)}
                  {' '}({services.find(s => s.id === serviceId)?.duration_minutes} dk)
                </div>
              )}

              {/* Not */}
              <div>
                <label className="label">Not (opsiyonel)</label>
                <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="input" placeholder="Ek bilgi..." />
              </div>

              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowModal(false); setEditingAppointment(null) }}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button type="submit" disabled={saving || !customerId} className="btn-primary flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
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
              <h2 className="text-lg font-semibold text-gray-900">Randevuyu Ertele</h2>
              <button
                onClick={() => setRescheduleAppointment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {rescheduleAppointment.customers?.name} — {formatTime(rescheduleAppointment.start_time)}
            </p>
            <form onSubmit={handleRescheduleSave} className="space-y-4">
              <div>
                <label className="label">Yeni Tarih</label>
                <input
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="input"
                  required
                />
              </div>
              <div>
                <label className="label">Yeni Saat</label>
                <select
                  value={rescheduleTime}
                  onChange={(e) => setRescheduleTime(e.target.value)}
                  className="input"
                  required
                >
                  {generateTimeSlots().map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setRescheduleAppointment(null)} className="btn-secondary flex-1">
                  Vazgeç
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Ertele
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
              <h2 className="text-lg font-semibold text-gray-900">Randevuyu İptal Et</h2>
              <button
                onClick={() => setCancelConfirmAppointment(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              {cancelConfirmAppointment.customers?.name} — {formatTime(cancelConfirmAppointment.start_time)} randevusunu iptal etmek istediğinize emin misiniz?
            </p>
            <label className="flex items-center gap-2 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={cancelNotifyCustomer}
                onChange={(e) => setCancelNotifyCustomer(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">Müşteriye WhatsApp ile iptal bildirimi gönder</span>
            </label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setCancelConfirmAppointment(null)}
                className="btn-secondary flex-1"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={saving}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin inline" /> : null}
                İptal Et
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
