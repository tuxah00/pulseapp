'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { toast } from 'sonner'
import {
  Plus, Megaphone, Send, Clock, CheckCircle2, XCircle, Ban,
  Users, Loader2, X, ChevronDown, ChevronUp, FileText, Pencil,
  Trash2, CalendarClock, ShieldX, Filter
} from 'lucide-react'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import EmptyState from '@/components/ui/empty-state'
import { CustomSelect } from '@/components/ui/custom-select'
import { Portal } from '@/components/ui/portal'
import { cn } from '@/lib/utils'
import type { Campaign, CustomerSegment } from '@/types'

const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: 'Yeni', regular: 'Düzenli', vip: 'VIP', risk: 'Risk', lost: 'Kayıp'
}

const SEGMENT_COLORS: Record<CustomerSegment, string> = {
  new: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  regular: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  vip: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  risk: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  lost: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
}

const STATUS_CONFIG = {
  draft: { label: 'Taslak', icon: FileText, color: 'text-gray-500 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-gray-800' },
  scheduled: { label: 'Zamanlandı', icon: CalendarClock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  sending: { label: 'Gönderiliyor', icon: Send, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  completed: { label: 'Tamamlandı', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' },
  cancelled: { label: 'İptal', icon: Ban, color: 'text-red-500 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' },
}

const CHANNEL_LABELS = { auto: 'Otomatik', sms: 'SMS', whatsapp: 'WhatsApp' }

const ALL_SEGMENTS: CustomerSegment[] = ['new', 'regular', 'vip', 'risk', 'lost']
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']

interface FormState {
  name: string
  description: string
  messageTemplate: string
  channel: string
  segments: CustomerSegment[]
  lastVisitDaysMin: string
  lastVisitDaysMax: string
  birthdayMonth: string
  minTotalVisits: string
  scheduledAt: string
  expiresAt: string
  maxRecipients: string
  sendNow: boolean
}

const INITIAL_FORM: FormState = {
  name: '', description: '', messageTemplate: '', channel: 'auto',
  segments: [], lastVisitDaysMin: '', lastVisitDaysMax: '',
  birthdayMonth: '', minTotalVisits: '', scheduledAt: '', expiresAt: '', maxRecipients: '', sendNow: false,
}

export default function CampaignsPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()

  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [closingModal, setClosingModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null)
  const [estimating, setEstimating] = useState(false)

  const fetchCampaigns = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch('/api/campaigns')
      const json = await res.json()
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Kampanyalar yüklenemedi' } }))
        return
      }
      setCampaigns(json.campaigns || [])
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally { setLoading(false) }
  }, [businessId])

  useEffect(() => { fetchCampaigns() }, [fetchCampaigns])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  const closeModal = () => setClosingModal(true)
  const onAnimEnd = () => { if (closingModal) { setShowModal(false); setClosingModal(false); setEditingId(null); setForm(INITIAL_FORM); setShowFilters(false); setEstimatedCount(null) } }

  const setField = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm(prev => ({ ...prev, [key]: val }))

  const toggleSegment = (seg: CustomerSegment) =>
    setField('segments', form.segments.includes(seg) ? form.segments.filter(s => s !== seg) : [...form.segments, seg])

  const openCreate = () => { setForm(INITIAL_FORM); setEditingId(null); setShowModal(true) }

  const openEdit = (c: Campaign) => {
    const f = c.segment_filter
    setForm({
      name: c.name,
      description: c.description || '',
      messageTemplate: c.message_template,
      channel: c.channel,
      segments: (f.segments || []) as CustomerSegment[],
      lastVisitDaysMin: f.lastVisitDaysMin ? String(f.lastVisitDaysMin) : '',
      lastVisitDaysMax: f.lastVisitDaysMax ? String(f.lastVisitDaysMax) : '',
      birthdayMonth: f.birthdayMonth ? String(f.birthdayMonth) : '',
      minTotalVisits: f.minTotalVisits ? String(f.minTotalVisits) : '',
      scheduledAt: c.scheduled_at ? c.scheduled_at.slice(0, 16) : '',
      expiresAt: c.expires_at ? c.expires_at.slice(0, 10) : '',
      maxRecipients: c.max_recipients ? String(c.max_recipients) : '',
      sendNow: false,
    })
    setEditingId(c.id)
    setShowFilters(
      !!(f.lastVisitDaysMin || f.lastVisitDaysMax || f.birthdayMonth || f.minTotalVisits)
    )
    setShowModal(true)
  }

  // Segment filtresine göre tahmini kitle hesapla
  const estimateAudience = async () => {
    if (!businessId) return
    setEstimating(true)
    try {
      const params = new URLSearchParams({ businessId, segments: form.segments.join(',') })
      if (form.lastVisitDaysMin) params.set('lastVisitDaysMin', form.lastVisitDaysMin)
      if (form.lastVisitDaysMax) params.set('lastVisitDaysMax', form.lastVisitDaysMax)
      if (form.birthdayMonth) params.set('birthdayMonth', form.birthdayMonth)
      if (form.minTotalVisits) params.set('minTotalVisits', form.minTotalVisits)
      const res = await fetch(`/api/campaigns/estimate?${params}`)
      const json = await res.json()
      setEstimatedCount(json.count ?? null)
    } catch { setEstimatedCount(null) }
    finally { setEstimating(false) }
  }

  const handleSave = async () => {
    if (!form.name || !form.messageTemplate) {
      toast.error('Ad ve mesaj şablonu zorunludur')
      return
    }
    setSaving(true)
    try {
      const segmentFilter: Record<string, any> = {}
      if (form.segments.length) segmentFilter.segments = form.segments
      if (form.lastVisitDaysMin) segmentFilter.lastVisitDaysMin = Number(form.lastVisitDaysMin)
      if (form.lastVisitDaysMax) segmentFilter.lastVisitDaysMax = Number(form.lastVisitDaysMax)
      if (form.birthdayMonth) segmentFilter.birthdayMonth = Number(form.birthdayMonth)
      if (form.minTotalVisits) segmentFilter.minTotalVisits = Number(form.minTotalVisits)

      if (editingId) {
        const res = await fetch('/api/campaigns', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editingId,
            name: form.name,
            description: form.description || null,
            segmentFilter,
            messageTemplate: form.messageTemplate,
            channel: form.channel,
            scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
            expiresAt: form.expiresAt ? new Date(form.expiresAt + 'T23:59:59').toISOString() : null,
            maxRecipients: form.maxRecipients ? Number(form.maxRecipients) : null,
          }),
        })
        if (!res.ok) { const j = await res.json(); toast.error(j.error || 'Güncellenemedi'); return }
        toast.success('Kampanya güncellendi')
      } else {
        const res = await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            description: form.description || null,
            segmentFilter,
            messageTemplate: form.messageTemplate,
            channel: form.channel,
            scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
            expiresAt: form.expiresAt ? new Date(form.expiresAt + 'T23:59:59').toISOString() : null,
            maxRecipients: form.maxRecipients ? Number(form.maxRecipients) : null,
            sendNow: form.sendNow,
          }),
        })
        if (!res.ok) { const j = await res.json(); toast.error(j.error || 'Oluşturulamadı'); return }
        toast.success(form.sendNow ? 'Kampanya gönderiliyor...' : (form.scheduledAt ? 'Kampanya zamanlandı' : 'Kampanya taslak olarak kaydedildi'))
      }

      closeModal()
      fetchCampaigns()
    } catch { toast.error('Bağlantı hatası') } finally { setSaving(false) }
  }

  const handleCancel = async (id: string) => {
    const res = await fetch('/api/campaigns', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'cancelled' }),
    })
    if (res.ok) { toast.success('Kampanya iptal edildi'); fetchCampaigns() }
  }

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/campaigns?id=${id}`, { method: 'DELETE' })
    if (res.ok) { toast.success('Kampanya silindi'); fetchCampaigns() }
  }

  const handleSendNow = async (campaign: Campaign) => {
    const res = await fetch('/api/campaigns/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campaignId: campaign.id }),
    })
    if (res.ok) { toast.success('Kampanya gönderiliyor...'); fetchCampaigns() }
    else toast.error('Gönderilemedi')
  }

  // Stats hesapla
  const totalSent = campaigns.filter(c => c.status === 'completed').reduce((s, c) => s + (c.stats?.sent || 0), 0)
  const totalRecipients = campaigns.filter(c => c.status === 'completed').reduce((s, c) => s + (c.stats?.total_recipients || 0), 0)
  const activeCampaigns = campaigns.filter(c => ['scheduled', 'sending'].includes(c.status)).length

  if (permissions && !permissions.campaigns) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kampanyalar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Müşteri segmentlerine toplu mesaj gönderin</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Yeni Kampanya
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toplam Kampanya</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{campaigns.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Aktif / Planlı</p>
          <p className="text-2xl font-bold text-blue-600">{activeCampaigns}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toplam Gönderim</p>
          <p className="text-2xl font-bold text-green-600">{totalSent.toLocaleString('tr-TR')}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Erişilen Kişi</p>
          <p className="text-2xl font-bold text-pulse-900">{totalRecipients.toLocaleString('tr-TR')}</p>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
      ) : campaigns.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Megaphone className="h-8 w-8" />}
            title="Henüz kampanya yok"
            description="Müşterilerinize toplu SMS veya WhatsApp göndermek için kampanya oluşturun"
            action={{ label: 'İlk Kampanyayı Oluştur', onClick: openCreate, icon: <Plus className="h-4 w-4" /> }}
          />
        </div>
      ) : (
        <AnimatedList className="space-y-3">
          {campaigns.map(c => {
            const cfg = STATUS_CONFIG[c.status]
            const StatusIcon = cfg.icon
            const isExpanded = expandedId === c.id
            const canEdit = ['draft', 'scheduled'].includes(c.status)
            const canSend = c.status === 'draft'
            const canCancel = ['scheduled', 'sending'].includes(c.status)
            const canDelete = ['draft', 'cancelled'].includes(c.status)

            return (
              <AnimatedItem key={c.id} className="card p-0 overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={cn('h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0', cfg.bg)}>
                      <StatusIcon className={cn('h-4 w-4', cfg.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 dark:text-white">{c.name}</p>
                        <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium', cfg.bg, cfg.color)}>{cfg.label}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                          {CHANNEL_LABELS[c.channel]}
                        </span>
                      </div>

                      {/* Segment pilleri */}
                      {c.segment_filter?.segments?.length ? (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(c.segment_filter.segments as CustomerSegment[]).map(seg => (
                            <span key={seg} className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', SEGMENT_COLORS[seg])}>
                              {SEGMENT_LABELS[seg]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-400 mt-0.5">Tüm müşteriler</p>
                      )}

                      {c.scheduled_at && c.status === 'scheduled' && (
                        <p className="text-xs text-blue-500 dark:text-blue-400 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(c.scheduled_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3 mt-1">
                        {c.expires_at && (
                          <p className="text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1">
                            <CalendarClock className="h-3 w-3" />
                            Bitiş: {new Date(c.expires_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        )}
                        {c.max_recipients && (
                          <p className="text-xs text-purple-500 dark:text-purple-400 flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            Maks. {c.max_recipients} kişi
                          </p>
                        )}
                      </div>

                      {c.status === 'completed' && (
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                            <Users className="h-3 w-3" /> {c.stats?.total_recipients || 0} kişi
                          </span>
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                            <Send className="h-3 w-3" /> {c.stats?.sent || 0} gönderildi
                          </span>
                          {(c.stats?.errors || 0) > 0 && (
                            <span className="text-xs text-red-500 flex items-center gap-1">
                              <XCircle className="h-3 w-3" /> {c.stats.errors} hata
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canSend && (
                        <button onClick={() => handleSendNow(c)}
                          className="text-xs px-2.5 py-1 rounded-lg bg-pulse-900 text-white hover:bg-pulse-800 flex items-center gap-1">
                          <Send className="h-3 w-3" /> Gönder
                        </button>
                      )}
                      {canEdit && (
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canCancel && (
                        <button onClick={() => handleCancel(c.id)}
                          className="p-1.5 text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg">
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => handleDelete(c.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button onClick={() => setExpandedId(isExpanded ? null : c.id)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Genişletilmiş mesaj önizlemesi */}
                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mesaj Şablonu</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{c.message_template}</p>
                    {c.description && (
                      <p className="text-xs text-gray-400 mt-2 italic">{c.description}</p>
                    )}
                  </div>
                )}
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      )}

      {/* ═══ Modal: Kampanya Oluştur / Düzenle ═══ */}
      {(showModal || closingModal) && (
        <Portal>
        <div
          className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingModal ? 'closing' : ''}`}
          onClick={closeModal}
          onAnimationEnd={onAnimEnd}
        >
          <div
            className={`modal-content card w-full max-w-xl dark:bg-gray-900 max-h-[90vh] overflow-y-auto ${closingModal ? 'closing' : ''}`}
            onClick={e => e.stopPropagation()}
          >
            {/* Modal başlık */}
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                  {editingId ? 'Kampanyayı Düzenle' : 'Yeni Kampanya'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {'{name}'} ve {'{businessName}'} değişkenleri kullanılabilir
                </p>
              </div>
              <button onClick={closeModal} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Temel bilgiler */}
              <div>
                <label className="label label-required">Kampanya Adı</label>
                <input className="input w-full" placeholder="ör. Nisan Ayı VIP İndirimi" value={form.name} onChange={e => setField('name', e.target.value)} />
              </div>

              <div>
                <label className="label">Açıklama (opsiyonel)</label>
                <input className="input w-full" placeholder="İç not" value={form.description} onChange={e => setField('description', e.target.value)} />
              </div>

              {/* Mesaj şablonu */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="label label-required mb-0">Mesaj Şablonu</label>
                  <span className={cn('text-xs', form.messageTemplate.length > 160 ? 'text-amber-500' : 'text-gray-400')}>
                    {form.messageTemplate.length} karakter
                  </span>
                </div>
                <textarea
                  className="input w-full resize-none"
                  rows={4}
                  placeholder="Merhaba {name} 👋 Bu ay %20 indirimle randevu fırsatını kaçırmayın!"
                  value={form.messageTemplate}
                  onChange={e => setField('messageTemplate', e.target.value)}
                />
                {form.messageTemplate.length > 160 && (
                  <p className="text-xs text-amber-500 mt-1">160 karakteri geçen mesajlar birden fazla SMS olarak sayılır.</p>
                )}
              </div>

              {/* Kanal */}
              <div>
                <label className="label">Gönderim Kanalı</label>
                <div className="flex gap-2">
                  {(['auto', 'sms', 'whatsapp'] as const).map(ch => (
                    <button key={ch} onClick={() => setField('channel', ch)}
                      className={cn('flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        form.channel === ch
                          ? 'bg-pulse-900 text-white border-pulse-900'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-pulse-900'
                      )}>
                      {CHANNEL_LABELS[ch]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Segment seçimi */}
              <div>
                <label className="label">Hedef Segment</label>
                <div className="flex flex-wrap gap-2">
                  {ALL_SEGMENTS.map(seg => (
                    <button key={seg} onClick={() => toggleSegment(seg)}
                      className={cn(
                        'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                        form.segments.includes(seg)
                          ? SEGMENT_COLORS[seg] + ' border-transparent'
                          : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-gray-400'
                      )}>
                      {SEGMENT_LABELS[seg]}
                    </button>
                  ))}
                </div>
                {form.segments.length === 0 && (
                  <p className="text-xs text-gray-400 mt-1">Seçilmezse tüm müşterilere gönderilir.</p>
                )}
              </div>

              {/* Gelişmiş filtreler */}
              <button onClick={() => setShowFilters(v => !v)} className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300">
                <Filter className="h-3.5 w-3.5" />
                Gelişmiş Filtreler
                {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>

              {showFilters && (
                <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Son Ziyaret En Az (gün önce)</label>
                      <input type="number" className="input w-full" placeholder="ör. 30" min="0"
                        value={form.lastVisitDaysMin} onChange={e => setField('lastVisitDaysMin', e.target.value)} />
                    </div>
                    <div>
                      <label className="label text-xs">Son Ziyaret En Fazla (gün önce)</label>
                      <input type="number" className="input w-full" placeholder="ör. 90" min="0"
                        value={form.lastVisitDaysMax} onChange={e => setField('lastVisitDaysMax', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">Doğum Günü Ayı</label>
                      <CustomSelect
                        options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
                        value={form.birthdayMonth}
                        onChange={v => setField('birthdayMonth', v)}
                        placeholder="— Seçin —"
                      />
                    </div>
                    <div>
                      <label className="label text-xs">Min. Ziyaret Sayısı</label>
                      <input type="number" className="input w-full" placeholder="ör. 3" min="0"
                        value={form.minTotalVisits} onChange={e => setField('minTotalVisits', e.target.value)} />
                    </div>
                  </div>

                  <button onClick={estimateAudience} disabled={estimating}
                    className="text-xs text-pulse-900 dark:text-pulse-300 hover:underline flex items-center gap-1">
                    {estimating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Users className="h-3 w-3" />}
                    Tahmini kitleyi hesapla
                  </button>
                  {estimatedCount !== null && (
                    <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                      Bu filtreyle yaklaşık <span className="text-pulse-900 dark:text-pulse-300 font-bold">{estimatedCount}</span> kişiye ulaşılacak.
                    </p>
                  )}
                </div>
              )}

              {/* Süre ve Sınır */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">Bitiş Tarihi <span className="font-normal text-gray-400">(opsiyonel)</span></label>
                  <input
                    type="date"
                    className="input w-full"
                    value={form.expiresAt}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={e => setField('expiresAt', e.target.value)}
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">Portalde gösterilecek son tarih</p>
                </div>
                <div>
                  <label className="label text-xs">Maks. Alıcı <span className="font-normal text-gray-400">(opsiyonel)</span></label>
                  <input
                    type="number"
                    className="input w-full"
                    placeholder="ör. 50"
                    min="1"
                    value={form.maxRecipients}
                    onChange={e => setField('maxRecipients', e.target.value)}
                  />
                  <p className="text-[11px] text-gray-400 mt-0.5">Sınırlı sayıda müşteriye</p>
                </div>
              </div>

              {/* Zamanlama */}
              {!editingId && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Gönderim Zamanı</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timing" checked={form.sendNow && !form.scheduledAt}
                      onChange={() => { setField('sendNow', true); setField('scheduledAt', '') }}
                      className="accent-pulse-900" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">Hemen gönder</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="timing" checked={!!form.scheduledAt}
                      onChange={() => { setField('sendNow', false) }}
                      className="accent-pulse-900" />
                    <span className="text-sm text-gray-700 dark:text-gray-300">İleri tarihe planla</span>
                  </label>
                  {(!!form.scheduledAt || (!form.sendNow && !form.scheduledAt)) && (
                    <input type="datetime-local" className="input w-full"
                      value={form.scheduledAt}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={e => { setField('scheduledAt', e.target.value); setField('sendNow', false) }} />
                  )}
                  {!form.sendNow && !form.scheduledAt && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="timing" checked={!form.sendNow && !form.scheduledAt}
                        onChange={() => {}} className="accent-pulse-900" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Taslak olarak kaydet</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-gray-100 dark:border-gray-800">
              <button onClick={closeModal} className="btn-secondary">İptal</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.messageTemplate} className="btn-primary disabled:opacity-50 flex items-center gap-2">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? 'Güncelle' : (form.sendNow ? 'Gönder' : (form.scheduledAt ? 'Zamanla' : 'Taslak Kaydet'))}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
