'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Clock, Search, Loader2, Phone, Calendar, User, Bell, BellOff, Trash2, X, ShieldX, CheckCircle, CalendarPlus, Zap, UserCircle2, SkipForward
} from 'lucide-react'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { CustomSelect } from '@/components/ui/custom-select'
import { Portal } from '@/components/ui/portal'
import { cn } from '@/lib/utils'

interface WaitlistEntry {
  id: string
  business_id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  service_id: string | null
  staff_id: string | null
  preferred_date: string | null
  preferred_time_start: string | null
  preferred_time_end: string | null
  notes: string | null
  is_notified: boolean
  is_active: boolean
  auto_book_on_match: boolean
  notification_expires_at: string | null
  notified_for_appointment_id: string | null
  created_at: string
  services?: { name: string } | null
  staff_members?: { name: string } | null
  customers?: { name: string; phone: string; segment: string } | null
}

interface ServiceOption {
  id: string
  name: string
}

function useCountdown(expiresAt: string | null) {
  const [left, setLeft] = useState<string | null>(null)
  useEffect(() => {
    if (!expiresAt) { setLeft(null); return }
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now()
      if (diff <= 0) { setLeft('Süresi doldu'); return }
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setLeft(`${m}:${String(s).padStart(2, '0')}`)
    }
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [expiresAt])
  return left
}

function CountdownBadge({ expiresAt }: { expiresAt: string | null }) {
  const left = useCountdown(expiresAt)
  if (!left) return null
  const expired = left === 'Süresi doldu'
  return (
    <span className={cn(
      'text-xs px-2 py-0.5 rounded-full flex items-center gap-1',
      expired
        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
        : 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
    )}>
      <Clock className="h-3 w-3" /> {expired ? 'Cevap süresi doldu' : `Kalan ${left}`}
    </span>
  )
}

export default function WaitlistPage() {
  const { businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)
  const supabase = createClient()

  const [entries, setEntries] = useState<WaitlistEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showActive, setShowActive] = useState(true)
  const [services, setServices] = useState<ServiceOption[]>([])
  const [staffMembers, setStaffMembers] = useState<ServiceOption[]>([])

  // Modal state — Listeye Ekle
  const [showCreate, setShowCreate] = useState(false)
  const [closingCreate, setClosingCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formServiceId, setFormServiceId] = useState('')
  const [formStaffId, setFormStaffId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTimeStart, setFormTimeStart] = useState('')
  const [formTimeEnd, setFormTimeEnd] = useState('')
  const [formNotes, setFormNotes] = useState('')
  // "Fark etmez" toggle'ları
  const [formAnyService, setFormAnyService] = useState(false)
  const [formAnyStaff, setFormAnyStaff] = useState(false)
  const [formAnyDate, setFormAnyDate] = useState(false)
  const [formAnyTime, setFormAnyTime] = useState(false)

  // Modal state — Randevu Oluştur
  const [showBook, setShowBook] = useState(false)
  const [closingBook, setClosingBook] = useState(false)
  const [bookEntry, setBookEntry] = useState<WaitlistEntry | null>(null)
  const [bookDate, setBookDate] = useState('')
  const [bookTimeStart, setBookTimeStart] = useState('')
  const [bookTimeEnd, setBookTimeEnd] = useState('')
  const [bookStaffId, setBookStaffId] = useState('')
  const [bookServiceId, setBookServiceId] = useState('')
  const [bookNotes, setBookNotes] = useState('')
  const [bookSaving, setBookSaving] = useState(false)

  const fetchEntries = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/waitlist?active=${showActive}`)
      const json = await res.json()
      setEntries(json.entries || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [businessId, showActive])

  const fetchServices = useCallback(async () => {
    if (!businessId) return
    try {
      const { data } = await supabase
        .from('services')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('sort_order')
      setServices((data || []).map((s: any) => ({ id: s.id, name: s.name })))
    } catch { /* ignore */ }
  }, [businessId, supabase])

  const fetchStaff = useCallback(async () => {
    if (!businessId) return
    try {
      const { data } = await supabase
        .from('staff_members')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('name')
      setStaffMembers((data || []).map((s: any) => ({ id: s.id, name: s.name })))
    } catch { /* ignore */ }
  }, [businessId, supabase])

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchServices() }, [fetchServices])
  useEffect(() => { fetchStaff() }, [fetchStaff])

  // ESC ile modal kapat
  useEffect(() => {
    if (!showCreate && !showBook) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showBook) setClosingBook(true)
        else setClosingCreate(true)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showCreate, showBook])

  const handleCreate = async () => {
    if (!formName || !formPhone) {
      toast.error('İsim ve telefon zorunludur')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formName,
          customerPhone: formPhone,
          customerId: formCustomerId || null,
          serviceId: formAnyService ? null : (formServiceId || null),
          staffId: formAnyStaff ? null : (formStaffId || null),
          preferredDate: formAnyDate ? null : (formDate || null),
          preferredTimeStart: formAnyTime ? null : (formTimeStart || null),
          preferredTimeEnd: formAnyTime ? null : (formTimeEnd || null),
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        toast.success('Bekleme listesine eklendi')
        setClosingCreate(true)
        resetForm()
        fetchEntries()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Eklenemedi')
      }
    } catch { toast.error('Bağlantı hatası') } finally { setSaving(false) }
  }

  const resetForm = () => {
    setFormCustomerId(''); setFormName(''); setFormPhone('')
    setFormServiceId(''); setFormStaffId(''); setFormDate(''); setFormTimeStart('')
    setFormTimeEnd(''); setFormNotes('')
    setFormAnyService(false); setFormAnyStaff(false); setFormAnyDate(false); setFormAnyTime(false)
  }

  const openBook = (entry: WaitlistEntry) => {
    setBookEntry(entry)
    setBookDate(entry.preferred_date || '')
    setBookTimeStart(entry.preferred_time_start?.substring(0, 5) || '')
    setBookTimeEnd(entry.preferred_time_end?.substring(0, 5) || '')
    setBookStaffId(entry.staff_id || '')
    setBookServiceId(entry.service_id || '')
    setBookNotes(entry.notes || '')
    setShowBook(true)
  }

  const handleBook = async () => {
    if (!bookEntry || !bookDate || !bookTimeStart) {
      toast.error('Tarih ve başlangıç saati zorunludur')
      return
    }
    if (!bookEntry.customer_id) {
      toast.error('Müşteri bilgisi eksik. Lütfen müşteriyi yeniden seçin.')
      return
    }
    setBookSaving(true)
    try {
      // Bitiş saati yoksa hizmet süresinden hesapla (yoksa 30 dk varsayılan)
      let effectiveEnd = bookTimeEnd
      if (!effectiveEnd) {
        let duration = 30
        if (bookServiceId) {
          const { data: svc } = await supabase
            .from('services')
            .select('duration_minutes')
            .eq('id', bookServiceId)
            .single()
          if (svc?.duration_minutes) duration = svc.duration_minutes
        }
        const [h, m] = bookTimeStart.split(':').map(Number)
        const total = h * 60 + m + duration
        const eh = String(Math.floor(total / 60)).padStart(2, '0')
        const em = String(total % 60).padStart(2, '0')
        effectiveEnd = `${eh}:${em}`
      }

      // Personel çakışma kontrolü — aynı personelin aynı gün örtüşen randevusu varsa engelle
      if (bookStaffId) {
        const toMin = (t: string) => {
          const [hh, mm] = t.split(':').map(Number)
          return hh * 60 + mm
        }
        const { data: dayApts } = await supabase
          .from('appointments')
          .select('start_time, end_time')
          .eq('business_id', businessId)
          .eq('staff_id', bookStaffId)
          .eq('appointment_date', bookDate)
          .in('status', ['pending', 'confirmed'])
          .is('deleted_at', null)

        const newStart = toMin(bookTimeStart)
        const newEnd = toMin(effectiveEnd)
        const hasConflict = (dayApts ?? []).some(a => {
          const s = toMin((a.start_time as string).substring(0, 5))
          const e = toMin((a.end_time as string).substring(0, 5))
          return newStart < e && s < newEnd
        })
        if (hasConflict) {
          toast.error('Bu personelin seçilen saatte zaten randevusu var. Farklı saat veya personel seçin.')
          return
        }
      }

      const { error } = await supabase.from('appointments').insert({
        business_id: businessId,
        customer_id: bookEntry.customer_id || null,
        service_id: bookServiceId || null,
        staff_id: bookStaffId || null,
        appointment_date: bookDate,
        start_time: bookTimeStart,
        end_time: effectiveEnd,
        notes: bookNotes || null,
        status: 'confirmed',
        source: 'manual',
      })
      if (error) {
        const raw = (error.message || '').toLowerCase()
        let msg = error.message
        if (raw.includes('customer_id') && raw.includes('null')) {
          msg = 'Müşteri bilgisi eksik. Lütfen müşteriyi yeniden seçin.'
        } else if (raw.includes('violates') && raw.includes('foreign key')) {
          msg = 'Seçilen kayıt artık mevcut değil. Lütfen sayfayı yenileyin.'
        } else if (raw.includes('duplicate') || raw.includes('unique')) {
          msg = 'Bu randevu zaten kayıtlı.'
        }
        toast.error(msg)
        return
      }
      // Bekleme listesinden kaldır
      await fetch('/api/waitlist', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: bookEntry.id, is_active: false }),
      })
      toast.success('Randevu oluşturuldu, bekleme listesinden kaldırıldı')
      setClosingBook(true)
      fetchEntries()
    } catch { toast.error('Bağlantı hatası') } finally { setBookSaving(false) }
  }

  const handleDeactivate = async (id: string) => {
    const res = await fetch('/api/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, is_active: false }),
    })
    if (res.ok) {
      toast.success('Listeden kaldırıldı')
      fetchEntries()
    }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/waitlist?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Kayıt silindi')
      fetchEntries()
    }
  }

  const handleNotifyNext = async (entry: WaitlistEntry) => {
    if (!entry.notified_for_appointment_id) {
      toast.error('Bu kayıt için bağlı bir boşluk bulunamadı')
      return
    }
    try {
      const res = await fetch(`/api/appointments/${entry.notified_for_appointment_id}/fill-gap/next`, { method: 'POST' })
      const json = await res.json()
      if (res.ok) {
        if (json.notified > 0) {
          toast.success(json.autoBooked ? 'Sıradaki hastaya otomatik randevu açıldı' : 'Sıradaki hastaya bildirim gönderildi')
        } else {
          toast.message(json.message || 'Sırada eşleşen hasta kalmadı')
        }
        fetchEntries()
      } else {
        toast.error(json.error || 'İşlem başarısız')
      }
    } catch { toast.error('Bağlantı hatası') }
  }

  const formatDateShort = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' })
  }

  const filtered = entries.filter(e => {
    if (!search) return true
    const q = search.toLowerCase()
    return e.customer_name.toLowerCase().includes(q) || e.customer_phone.includes(q)
  })

  const activeCount = entries.filter(e => e.is_active).length
  const notifiedCount = entries.filter(e => e.is_notified).length

  // Permission check
  if (permissions && !permissions.appointments) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <ShieldX className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    )
  }

  if (ctxLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bekleme Listesi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Randevu bekleyen {customerLabel.toLowerCase()}ları yönetin
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Listeye Ekle
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Aktif Bekleyen</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{activeCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Bildirim Gönderilen</p>
          <p className="text-2xl font-bold text-green-600">{notifiedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toplam Kayıt</p>
          <p className="text-2xl font-bold text-pulse-900">{entries.length}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="İsim veya telefon ara..." className="input pl-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowActive(true)}
            className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', showActive ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
            Aktif
          </button>
          <button onClick={() => setShowActive(false)}
            className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', !showActive ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
            Tümü
          </button>
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <Clock className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Bekleme listesi boş</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Yeni bir kayıt eklemek için butonu kullanın</p>
        </div>
      ) : (
        <AnimatedList className="space-y-3">
          {filtered.map(e => (
            <AnimatedItem key={e.id} className="card p-4 cursor-pointer hover:ring-1 hover:ring-pulse-500/40 transition-all" onClick={() => openBook(e)}>
              <div className="flex items-start gap-4">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                  e.is_notified
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-pulse-100 dark:bg-pulse-900/30 text-pulse-700 dark:text-pulse-300'
                )}>
                  {e.is_notified ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{e.customer_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {e.customer_phone}
                    </p>
                    {e.auto_book_on_match && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                        <Zap className="h-3 w-3" /> Otomatik Randevu
                      </span>
                    )}
                  </div>
                  {/* Tercih rozetleri */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    {e.services?.name ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                        {e.services.name}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Hizmet: fark etmez</span>
                    )}
                    {e.preferred_date ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {formatDateShort(e.preferred_date)}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Tarih: fark etmez</span>
                    )}
                    {e.preferred_time_start ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {e.preferred_time_start.substring(0, 5)}
                        {e.preferred_time_end && `-${e.preferred_time_end.substring(0, 5)}`}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Saat: fark etmez</span>
                    )}
                    {e.staff_members?.name ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 flex items-center gap-1">
                        <UserCircle2 className="h-3 w-3" /> {e.staff_members.name}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">Personel: fark etmez</span>
                    )}
                  </div>
                  {e.notes && <p className="text-xs text-gray-400 mt-1 truncate">{e.notes}</p>}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 self-center" onClick={ev => ev.stopPropagation()}>
                  {e.is_notified && e.is_active && <CountdownBadge expiresAt={e.notification_expires_at} />}
                  {e.is_notified && !e.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Bell className="h-3 w-3" /> Bildirildi
                    </span>
                  )}
                  {!e.is_notified && !e.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <BellOff className="h-3 w-3" /> Pasif
                    </span>
                  )}
                  <p className="text-[10px] text-gray-400">{new Date(e.created_at).toLocaleDateString('tr-TR')}</p>
                  {e.is_active && e.is_notified && e.notified_for_appointment_id && (
                    <button
                      onClick={ev => { ev.stopPropagation(); handleNotifyNext(e) }}
                      className="text-amber-600 hover:text-amber-700 transition-colors p-1"
                      title="Sıradaki hastaya bildirim gönder"
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>
                  )}
                  {e.is_active && (
                    <button
                      onClick={ev => { ev.stopPropagation(); openBook(e) }}
                      className="text-pulse-600 hover:text-pulse-700 transition-colors p-1"
                      title="Randevu Oluştur"
                    >
                      <CalendarPlus className="h-4 w-4" />
                    </button>
                  )}
                  {e.is_active && (
                    <button onClick={ev => { ev.stopPropagation(); handleDeactivate(e.id) }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Listeden Kaldır">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedList>
      )}

      {/* ═══ Modal: Randevu Oluştur ═══ */}
      {(showBook || closingBook) && bookEntry && (
        <Portal>
          <div
            className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingBook ? 'closing' : ''}`}
            onClick={() => setClosingBook(true)}
            onAnimationEnd={() => { if (closingBook) { setShowBook(false); setClosingBook(false); setBookEntry(null) } }}
          >
            <div className={`modal-content card w-full max-w-lg dark:bg-gray-900 ${closingBook ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">Randevu Oluştur</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{bookEntry.customer_name} · {bookEntry.customer_phone}</p>
                </div>
                <button onClick={() => setClosingBook(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-3 sm:col-span-1">
                    <label className="label label-required">Tarih</label>
                    <input type="date" className="input w-full" value={bookDate} onChange={e => setBookDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label label-required">Başlangıç</label>
                    <input type="time" className="input w-full" value={bookTimeStart} onChange={e => setBookTimeStart(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Bitiş</label>
                    <input type="time" className="input w-full" value={bookTimeEnd} onChange={e => setBookTimeEnd(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="label">Personel</label>
                  <CustomSelect
                    options={staffMembers.map(s => ({ value: s.id, label: s.name }))}
                    value={bookStaffId}
                    onChange={v => setBookStaffId(v)}
                    placeholder="Personel seçin"
                  />
                </div>
                <div>
                  <label className="label">Hizmet</label>
                  <CustomSelect
                    options={services.map(s => ({ value: s.id, label: s.name }))}
                    value={bookServiceId}
                    onChange={v => setBookServiceId(v)}
                    placeholder="Hizmet seçin"
                  />
                </div>
                <div>
                  <label className="label">Not</label>
                  <textarea className="input w-full" rows={2} placeholder="Opsiyonel not..." value={bookNotes} onChange={e => setBookNotes(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setClosingBook(true)} className="btn-secondary">İptal</button>
                <button onClick={handleBook} disabled={bookSaving || !bookDate || !bookTimeStart} className="btn-primary disabled:opacity-50">
                  {bookSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <CalendarPlus className="h-4 w-4 mr-1 inline" />} Randevu Oluştur
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* ═══ Modal: Listeye Ekle ═══ */}
      {(showCreate || closingCreate) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingCreate ? 'closing' : ''}`} onClick={() => setClosingCreate(true)} onAnimationEnd={() => { if (closingCreate) { setShowCreate(false); setClosingCreate(false) } }}>
          <div className={`modal-content card w-full max-w-lg dark:bg-gray-900 ${closingCreate ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium text-gray-900 dark:text-white">Bekleme Listesine Ekle</h3>
              <button onClick={() => setClosingCreate(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">Mevcut {customerLabel} (opsiyonel)</label>
                <CustomerSearchSelect
                  value={formCustomerId}
                  onChange={v => {
                    setFormCustomerId(v)
                    if (!v) { setFormName(''); setFormPhone('') }
                  }}
                  onCustomerSelect={(c) => {
                    if (c) { setFormName(c.name); setFormPhone(c.phone) }
                  }}
                  businessId={businessId!}
                  placeholder={`${customerLabel} ara...`}
                />
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                  Mevcut {customerLabel.toLowerCase()} seçerseniz ad ve telefon otomatik doldurulur.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label label-required">Ad Soyad</label>
                  <input className="input w-full" placeholder="İsim" value={formName} onChange={e => setFormName(e.target.value)} disabled={!!formCustomerId} />
                </div>
                <div>
                  <label className="label label-required">Telefon</label>
                  <input className="input w-full" placeholder="05XX XXX XXXX" value={formPhone} onChange={e => setFormPhone(e.target.value)} disabled={!!formCustomerId} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Hizmet</label>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-gray-500 dark:text-gray-400">
                      <input type="checkbox" checked={formAnyService} onChange={e => { setFormAnyService(e.target.checked); if (e.target.checked) setFormServiceId('') }} className="rounded" />
                      Fark etmez
                    </label>
                  </div>
                  {formAnyService ? (
                    <div className="input w-full text-gray-400 dark:text-gray-500 text-sm bg-gray-50 dark:bg-gray-800 pointer-events-none">Fark etmez</div>
                  ) : (
                    <CustomSelect
                      options={services.map(s => ({ value: s.id, label: s.name }))}
                      value={formServiceId}
                      onChange={v => setFormServiceId(v)}
                      placeholder="Hizmet seçin"
                    />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Personel</label>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-gray-500 dark:text-gray-400">
                      <input type="checkbox" checked={formAnyStaff} onChange={e => { setFormAnyStaff(e.target.checked); if (e.target.checked) setFormStaffId('') }} className="rounded" />
                      Fark etmez
                    </label>
                  </div>
                  {formAnyStaff ? (
                    <div className="input w-full text-gray-400 dark:text-gray-500 text-sm bg-gray-50 dark:bg-gray-800 pointer-events-none">Fark etmez</div>
                  ) : (
                    <CustomSelect
                      options={staffMembers.map(s => ({ value: s.id, label: s.name }))}
                      value={formStaffId}
                      onChange={v => setFormStaffId(v)}
                      placeholder="Personel seçin"
                    />
                  )}
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Tercih Tarihi</label>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-gray-500 dark:text-gray-400">
                      <input type="checkbox" checked={formAnyDate} onChange={e => { setFormAnyDate(e.target.checked); if (e.target.checked) setFormDate('') }} className="rounded" />
                      Fark etmez
                    </label>
                  </div>
                  {formAnyDate ? (
                    <div className="input w-full text-gray-400 dark:text-gray-500 text-sm bg-gray-50 dark:bg-gray-800">Fark etmez</div>
                  ) : (
                    <input type="date" className="input w-full" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Başlangıç</label>
                    <label className="flex items-center gap-1 cursor-pointer select-none text-[11px] text-gray-500 dark:text-gray-400">
                      <input type="checkbox" checked={formAnyTime} onChange={e => { setFormAnyTime(e.target.checked); if (e.target.checked) { setFormTimeStart(''); setFormTimeEnd('') } }} className="rounded" />
                      Fark etmez
                    </label>
                  </div>
                  {formAnyTime ? (
                    <div className="input w-full text-gray-400 dark:text-gray-500 text-sm bg-gray-50 dark:bg-gray-800">Fark etmez</div>
                  ) : (
                    <input type="time" className="input w-full" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} />
                  )}
                </div>
                <div>
                  <label className="label">Bitiş</label>
                  {formAnyTime ? (
                    <div className="input w-full text-gray-400 dark:text-gray-500 text-sm bg-gray-50 dark:bg-gray-800">Fark etmez</div>
                  ) : (
                    <input type="time" className="input w-full" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} />
                  )}
                </div>
              </div>
              <div>
                <label className="label">Not</label>
                <textarea className="input w-full" rows={2} placeholder="Opsiyonel not..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setClosingCreate(true)} className="btn-secondary">İptal</button>
              <button onClick={handleCreate} disabled={saving || !formName || !formPhone} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Plus className="h-4 w-4 mr-1 inline" />} Ekle
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
