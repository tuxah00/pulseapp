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
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import EmptyState from '@/components/ui/empty-state'
import { logAudit } from '@/lib/utils/audit'

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
  const { businessId, staffId, staffName, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)
  const supabase = createClient()
  const { confirm } = useConfirm()

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
      // Sıralama: önce müşteri onayı bekleyenler (is_notified=true && is_active=true,
      // amber çan ikonu), sonra diğerleri öncelik (FIFO = created_at ascending) sırasına göre.
      // Bu sayede personel acil aksiyon gerektiren kayıtları en üstte görür.
      const sorted: WaitlistEntry[] = ((json.entries || []) as WaitlistEntry[]).sort((a, b) => {
        const aWaiting = a.is_notified && a.is_active ? 0 : 1
        const bWaiting = b.is_notified && b.is_active ? 0 : 1
        if (aWaiting !== bWaiting) return aWaiting - bWaiting
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      })
      setEntries(sorted)
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
    // En az bir tercih kriteri (hizmet, personel, tarih veya saat) zorunlu —
    // hepsi boş olursa müşteri her boşlukta bildirim alır, hedefsiz spam olur.
    if (!formServiceId && !formStaffId && !formDate && !formTimeStart) {
      toast.error('Hizmet, personel, tarih veya saat tercihlerinden en az birini seçmelisin')
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
          serviceId: formServiceId || null,
          staffId: formStaffId || null,
          preferredDate: formDate || null,
          preferredTimeStart: formTimeStart || null,
          preferredTimeEnd: formTimeEnd || null,
          notes: formNotes || null,
        }),
      })
      if (res.ok) {
        const json = await res.json().catch(() => ({}))
        // Proaktif tarama sonucu — server yeni kayıt için takvimi taradı
        if (json.autoMatch?.matched && json.autoMatch.slot) {
          const { date, time } = json.autoMatch.slot
          const formatted = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', {
            day: 'numeric', month: 'long'
          })
          toast.success(`Eklendi — ${formatted} ${time.substring(0, 5)} için bildirim gönderildi`)
        } else {
          toast.success('Bekleme listesine eklendi (uygun slot bulunamadı, açıldıkça bildirilecek)')
        }
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
    setBookSaving(true)
    try {
      // customer_id yoksa telefona göre müşteriyi bul, yoksa oluştur
      let resolvedCustomerId: string | null = bookEntry.customer_id || null
      if (!resolvedCustomerId) {
        const phone = bookEntry.customer_phone
        if (!phone) {
          toast.error('Müşteri telefon numarası eksik.')
          return
        }
        const { data: existing } = await supabase
          .from('customers')
          .select('id')
          .eq('business_id', businessId)
          .eq('phone', phone)
          .limit(1)
          .maybeSingle()
        if (existing) {
          resolvedCustomerId = existing.id
        } else {
          const { data: created, error: createErr } = await supabase
            .from('customers')
            .insert({ business_id: businessId, name: bookEntry.customer_name, phone, segment: 'new' })
            .select('id')
            .single()
          if (createErr || !created) {
            toast.error('Müşteri kaydı oluşturulamadı: ' + (createErr?.message || 'bilinmiyor'))
            return
          }
          resolvedCustomerId = created.id
          await logAudit({
            businessId: businessId!,
            staffId: staffId ?? null,
            staffName: staffName ?? null,
            action: 'create',
            resource: 'customer',
            resourceId: created.id,
            details: { name: bookEntry.customer_name, phone },
          })
        }
        // Waitlist entry'yi customer_id ile güncelle
        await supabase.from('waitlist_entries').update({ customer_id: resolvedCustomerId }).eq('id', bookEntry.id)
      }

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

      // Kapalı gün + mesai saati kontrolü
      const DAY_KEYS_WH = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
      const toMinWH = (t: string) => { const [hh, mm] = t.split(':').map(Number); return hh * 60 + mm }
      const { data: bizWH } = await supabase.from('businesses').select('working_hours').eq('id', businessId).single()
      if (bizWH?.working_hours) {
        const wh = bizWH.working_hours as Record<string, { open: string; close: string } | null>
        const dayKey = DAY_KEYS_WH[new Date(bookDate + 'T00:00:00').getDay()]
        const hours = wh[dayKey]
        if (!hours) {
          const dayNames: Record<string, string> = { mon: 'Pazartesi', tue: 'Salı', wed: 'Çarşamba', thu: 'Perşembe', fri: 'Cuma', sat: 'Cumartesi', sun: 'Pazar' }
          toast.error(`${dayNames[dayKey] || dayKey} günü işletme kapalı, randevu alınamaz.`)
          return
        }
        const startMin = toMinWH(bookTimeStart)
        const endMin = toMinWH(effectiveEnd)
        const openMin = toMinWH(hours.open)
        const closeMin = toMinWH(hours.close)
        if (startMin < openMin || startMin >= closeMin) {
          toast.error(`Başlangıç saati mesai saatleri dışında. Çalışma saatleri: ${hours.open}–${hours.close}`)
          return
        }
        if (endMin <= startMin) {
          toast.error(`Bitiş saati (${effectiveEnd}) başlangıç saatinden (${bookTimeStart}) önce veya eşit olamaz.`)
          return
        }
        if (endMin < openMin || endMin > closeMin) {
          toast.error(`Randevu bitiş saati (${effectiveEnd}) mesai saatleri dışında. Çalışma saatleri: ${hours.open}–${hours.close}`)
          return
        }
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
        customer_id: resolvedCustomerId,
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

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Kaydı Sil',
      message: 'Bu bekleme listesi kaydını silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.',
      confirmText: 'Sil',
      variant: 'danger',
    })
    if (!ok) return
    const res = await fetch(`/api/waitlist?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Kayıt silindi')
      setEntries(prev => prev.filter(e => e.id !== id))
    } else {
      toast.error('Silinemedi')
    }
  }

  const handleAutoMatch = async (entry: WaitlistEntry) => {
    try {
      const res = await fetch(`/api/waitlist/${entry.id}/auto-match`, { method: 'POST' })
      const json = await res.json()
      if (res.ok && json.matched && json.slot) {
        const formatted = new Date(json.slot.date + 'T00:00:00').toLocaleDateString('tr-TR', {
          day: 'numeric', month: 'long'
        })
        toast.success(`${formatted} ${json.slot.time.substring(0, 5)} için bildirim gönderildi`)
        fetchEntries()
      } else {
        toast.message(json.reason || 'Uygun slot bulunamadı')
      }
    } catch { toast.error('Bağlantı hatası') }
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
  requirePermission(permissions, 'waitlist')

  if (ctxLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Bekleme Listesi</h1>
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
        <EmptyState
          icon={<Clock className="h-8 w-8" />}
          title="Bekleme listesi boş"
          description="Yeni bir kayıt eklemek için butonu kullanın"
        />
      ) : (
        <AnimatedList className="space-y-3">
          {filtered.map(e => (
            <AnimatedItem key={e.id} className="card p-4 cursor-pointer hover:ring-1 hover:ring-pulse-900/40 transition-all" onClick={() => openBook(e)}>
              <div className="flex items-start gap-4">
                {/* Avatar — 3 durum:
                    1) Pasif (is_active=false): gri BellOff = sürç dolmuş veya silinmiş
                    2) Onay bekleniyor (is_notified=true && is_active=true): amber Bell = SMS gitti, müşteri onayı bekleniyor
                    3) Sırada bekliyor (is_notified=false): mavi Clock = bildirim henüz atılmadı
                    Yeşil CheckCircle = onaylanmış randevu YOK; held_until null olunca normal randevu olur,
                    bekleme listesi kaydı is_active=false olur (artık burada görünmez). */}
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                  !e.is_active
                    ? 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    : e.is_notified
                      ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                      : 'bg-pulse-100 dark:bg-pulse-900/30 text-pulse-700 dark:text-pulse-300'
                )}>
                  {!e.is_active
                    ? <BellOff className="h-5 w-5" />
                    : e.is_notified
                      ? <Bell className="h-5 w-5" />
                      : <Clock className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{e.customer_name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {e.customer_phone}
                    </p>
                    {e.auto_book_on_match && (
                      <span className="badge-warning text-[11px]">
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
                </div>
                <div className="flex-shrink-0 flex items-center gap-2 self-center" onClick={ev => ev.stopPropagation()}>
                  {e.is_notified && e.is_active && <CountdownBadge expiresAt={e.notification_expires_at} />}
                  {e.is_notified && !e.is_active && (
                    <span className="badge-success text-xs">
                      <Bell className="h-3 w-3" /> Bildirildi
                    </span>
                  )}
                  {!e.is_notified && !e.is_active && (
                    <span className="badge-neutral text-xs">
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
                  {e.is_active && !e.is_notified && (
                    <button
                      onClick={ev => { ev.stopPropagation(); handleAutoMatch(e) }}
                      className="text-emerald-600 hover:text-emerald-700 transition-colors p-1"
                      title="Takvimde uygun slot ara ve bildirim gönder"
                    >
                      <Zap className="h-4 w-4" />
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
                  <button onClick={ev => { ev.stopPropagation(); handleDelete(e.id) }} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Kaydı Sil">
                    <Trash2 className="h-4 w-4" />
                  </button>
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
            className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${closingBook ? 'closing' : ''}`}
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
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${closingCreate ? 'closing' : ''}`} onClick={() => setClosingCreate(true)} onAnimationEnd={() => { if (closingCreate) { setShowCreate(false); setClosingCreate(false) } }}>
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
              <p className="text-xs text-gray-500 dark:text-gray-400 -mt-1">
                Hizmet, personel, tarih veya saat tercihlerinden <span className="font-medium">en az birini</span> seçmelisin —
                tüm boşluklara eşleşmesin, sadece müşterinin gerçekten istediği zamana bildirim gitsin.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Hizmet</label>
                  <CustomSelect
                    options={services.map(s => ({ value: s.id, label: s.name }))}
                    value={formServiceId}
                    onChange={v => setFormServiceId(v)}
                    placeholder="Fark etmez"
                  />
                </div>
                <div>
                  <label className="label">Personel</label>
                  <CustomSelect
                    options={staffMembers.map(s => ({ value: s.id, label: s.name }))}
                    value={formStaffId}
                    onChange={v => setFormStaffId(v)}
                    placeholder="Fark etmez"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Tercih Tarihi</label>
                  <input type="date" className="input w-full" value={formDate} onChange={e => setFormDate(e.target.value)} />
                  <p className="text-[10px] text-gray-400 mt-1">Boş = fark etmez</p>
                </div>
                <div>
                  <label className="label">Başlangıç</label>
                  <input type="time" className="input w-full" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} />
                  <p className="text-[10px] text-gray-400 mt-1">Boş = fark etmez</p>
                </div>
                <div>
                  <label className="label">Bitiş</label>
                  <input type="time" className="input w-full" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} />
                  <p className="text-[10px] text-gray-400 mt-1">Boş = fark etmez</p>
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
