'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, Clock, Search, Loader2, Phone, Calendar, User, Bell, BellOff, Trash2, X, ShieldX, CheckCircle
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
  created_at: string
  services?: { name: string } | null
  staff_members?: { name: string } | null
  customers?: { name: string; phone: string; segment: string } | null
}

interface ServiceOption {
  id: string
  name: string
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

  // Modal state
  const [showCreate, setShowCreate] = useState(false)
  const [closingCreate, setClosingCreate] = useState(false)
  const [saving, setSaving] = useState(false)

  // Form
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formName, setFormName] = useState('')
  const [formPhone, setFormPhone] = useState('')
  const [formServiceId, setFormServiceId] = useState('')
  const [formDate, setFormDate] = useState('')
  const [formTimeStart, setFormTimeStart] = useState('')
  const [formTimeEnd, setFormTimeEnd] = useState('')
  const [formNotes, setFormNotes] = useState('')

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

  useEffect(() => { fetchEntries() }, [fetchEntries])
  useEffect(() => { fetchServices() }, [fetchServices])

  // ESC ile modal kapat
  useEffect(() => {
    if (!showCreate) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setClosingCreate(true) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showCreate])

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
          serviceId: formServiceId || null,
          preferredDate: formDate || null,
          preferredTimeStart: formTimeStart || null,
          preferredTimeEnd: formTimeEnd || null,
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
    setFormServiceId(''); setFormDate(''); setFormTimeStart('')
    setFormTimeEnd(''); setFormNotes('')
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
            <AnimatedItem key={e.id} className="card p-4">
              <div className="flex items-center gap-4">
                <div className={cn(
                  'h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0',
                  e.is_notified
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                    : 'bg-pulse-100 dark:bg-pulse-900/30 text-pulse-700 dark:text-pulse-300'
                )}>
                  {e.is_notified ? <CheckCircle className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 dark:text-white truncate">{e.customer_name}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                    <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {e.customer_phone}
                    </p>
                    {e.services?.name && (
                      <p className="text-xs text-purple-600 dark:text-purple-400">{e.services.name}</p>
                    )}
                    {e.preferred_date && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> {new Date(e.preferred_date).toLocaleDateString('tr-TR')}
                        {e.preferred_time_start && ` ${e.preferred_time_start.substring(0, 5)}`}
                        {e.preferred_time_end && `-${e.preferred_time_end.substring(0, 5)}`}
                      </p>
                    )}
                  </div>
                  {e.notes && <p className="text-xs text-gray-400 mt-1 truncate">{e.notes}</p>}
                </div>
                <div className="flex-shrink-0 flex items-center gap-2">
                  {e.is_notified && (
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
                  {e.is_active && (
                    <button onClick={() => handleDeactivate(e.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Listeden Kaldır">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedList>
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
              <div>
                <label className="label">Hizmet (opsiyonel)</label>
                <CustomSelect
                  options={services.map(s => ({ value: s.id, label: s.name }))}
                  value={formServiceId}
                  onChange={v => setFormServiceId(v)}
                  placeholder="Hizmet seçin"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Tercih Tarihi</label>
                  <input type="date" className="input w-full" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Başlangıç</label>
                  <input type="time" className="input w-full" value={formTimeStart} onChange={e => setFormTimeStart(e.target.value)} />
                </div>
                <div>
                  <label className="label">Bitiş</label>
                  <input type="time" className="input w-full" value={formTimeEnd} onChange={e => setFormTimeEnd(e.target.value)} />
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
