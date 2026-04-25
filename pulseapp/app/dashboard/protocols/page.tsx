'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import { getTreatmentNotesPlaceholder } from '@/lib/config/sector-labels'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, ClipboardCheck, Search, X, Calendar, User, Activity,
  ChevronRight, Loader2, Pause, Play, CheckCircle, XCircle, SkipForward,
  Camera, FileText, Clock, Upload, MessageSquare, Pencil, Save,
} from 'lucide-react'
import type {
  TreatmentProtocol, ProtocolSession, Service, ProtocolStatus, SessionStatus
} from '@/types'
import { cn } from '@/lib/utils'
import { PROTOCOL_STATUS_LABELS, SESSION_STATUS_LABELS } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { Portal } from '@/components/ui/portal'
import { Pagination } from '@/components/ui/pagination'
import { FollowUpQuickModal } from '@/components/dashboard/follow-up-quick-modal'
import EmptyState from '@/components/ui/empty-state'

const STATUS_BADGE: Record<ProtocolStatus, string> = {
  active: 'badge-info',
  completed: 'badge-success',
  cancelled: 'badge-danger',
  paused: 'badge-warning',
}

const SESSION_STATUS_CONFIG: Record<SessionStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  planned: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500', icon: Clock },
  completed: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', icon: XCircle },
  skipped: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', icon: SkipForward },
}

export default function ProtocolsPage() {
  const { businessId, sector, permissions, loading: ctxLoading } = useBusinessContext()
  requireSectorModule(sector, 'protocols')
  requirePermission(permissions, 'protocols')
  const { confirm } = useConfirm()
  const searchParams = useSearchParams()
  const router = useRouter()

  // State
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedProtocol, setSelectedProtocol] = useState<TreatmentProtocol | null>(null)
  const [isClosingDetail, setIsClosingDetail] = useState(false)
  const closeDetail = () => setIsClosingDetail(true)
  // Follow-up modal
  const [followUpTarget, setFollowUpTarget] = useState<{ protocolId: string; customerId: string; customerName: string } | null>(null)

  // Create modal
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 50

  const [showCreate, setShowCreate] = useState(false)
  const [isClosingCreate, setIsClosingCreate] = useState(false)
  const closeCreate = () => setIsClosingCreate(true)
  const [saving, setSaving] = useState(false)
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formServiceId, setFormServiceId] = useState('')
  const [formName, setFormName] = useState('')
  const [formSessions, setFormSessions] = useState(6)
  const [formInterval, setFormInterval] = useState(14)
  const [formNotes, setFormNotes] = useState('')

  // Data fetching
  const fetchProtocols = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))
      const res = await fetch(`/api/protocols?${params}`)
      const json = await res.json()
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Protokoller yüklenemedi' } }))
        return
      }
      setProtocols(json.protocols || [])
      setTotalCount(json.total || 0)
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası', body: 'Protokoller yüklenemedi' } }))
    } finally { setLoading(false) }
  }, [businessId, statusFilter, page])

  const fetchMeta = useCallback(async () => {
    if (!businessId) return
    const supabase = createClient()
    const { data: svcsData } = await supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true).order('sort_order')
    setServices(svcsData || [])
  }, [businessId])

  useEffect(() => { fetchProtocols() }, [fetchProtocols])
  useEffect(() => { fetchMeta() }, [fetchMeta])
  useEffect(() => { setPage(0) }, [statusFilter])

  // URL ?protocolId= → protokolü çekip detay panelinde aç (Takipler deep-link)
  // One-shot: aynı protocolId için tekrar tetiklenmez; URL temizliği fetch sonrasına alındı
  const protocolDeepLinkConsumed = useRef<string | null>(null)
  useEffect(() => {
    const protocolId = searchParams?.get('protocolId')
    if (!protocolId || !businessId || ctxLoading) return
    if (protocolDeepLinkConsumed.current === protocolId) return
    protocolDeepLinkConsumed.current = protocolId
    fetch(`/api/protocols/${protocolId}`)
      .then(r => r.json())
      .then(json => {
        if (json.protocol) setSelectedProtocol(json.protocol)
        router.replace('/dashboard/protocols', { scroll: false })
      })
  }, [searchParams, businessId, ctxLoading]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showCreate) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCreate() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showCreate])

  useEffect(() => {
    if (!selectedProtocol) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape' && !showCreate) closeDetail() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [selectedProtocol, showCreate])

  // Create protocol
  const handleCreate = async () => {
    if (!businessId || !formCustomerId || !formName || formSessions < 1) return
    setSaving(true)
    try {
      const res = await fetch('/api/protocols', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId, customerId: formCustomerId, serviceId: formServiceId || null,
          name: formName, totalSessions: formSessions, intervalDays: formInterval, notes: formNotes || null,
        }),
      })
      if (res.ok) {
        closeCreate()
        resetForm()
        fetchProtocols()
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Oluşturuldu' } }))
      } else {
        const json = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Oluşturulamadı' } }))
      }
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    } finally { setSaving(false) }
  }

  const resetForm = () => {
    setFormCustomerId('')
    setFormServiceId('')
    setFormName('')
    setFormSessions(6)
    setFormInterval(14)
    setFormNotes('')
  }

  // Update protocol status
  const updateProtocolStatus = async (protocolId: string, status: ProtocolStatus) => {
    if (!businessId) return
    try {
      const res = await fetch(`/api/protocols/${protocolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Durum güncellenemedi' } }))
        return
      }
      fetchProtocols()
      if (selectedProtocol?.id === protocolId) {
        setSelectedProtocol(prev => prev ? { ...prev, status } : null)
      }
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))

      // Protokol tamamlandığında takip teklif modal'ı
      if (status === 'completed') {
        const proto = protocols.find(p => p.id === protocolId) || selectedProtocol
        const customer = proto ? (Array.isArray(proto.customer) ? proto.customer[0] : proto.customer) : null
        if (customer?.id && customer?.name) {
          setFollowUpTarget({ protocolId, customerId: customer.id, customerName: customer.name })
        }
      }
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    }
  }

  // Update session
  const updateSession = async (protocolId: string, sessionId: string, status: SessionStatus) => {
    if (!businessId) return
    try {
      const res = await fetch(`/api/protocols/${protocolId}/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, status }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Seans güncellenemedi' } }))
        return
      }
      // Refresh list and detail in parallel
      const [, detailJson] = await Promise.all([
        fetchProtocols(),
        fetch(`/api/protocols/${protocolId}`).then(r => r.json()),
      ])
      if (detailJson.protocol) setSelectedProtocol(detailJson.protocol)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    }
  }

  // Refresh single protocol (for photo uploads etc.)
  const refreshProtocol = useCallback(async (protocolId: string) => {
    if (!businessId) return
    try {
      const [, detailJson] = await Promise.all([
        fetchProtocols(),
        fetch(`/api/protocols/${protocolId}`).then(r => r.json()),
      ])
      if (detailJson.protocol) setSelectedProtocol(detailJson.protocol)
    } catch { /* ignore */ }
  }, [businessId, fetchProtocols])

  // Delete protocol
  const handleDelete = async (protocolId: string) => {
    if (!businessId) return
    const ok = await confirm({
      title: 'Protokolü Sil',
      message: 'Bu tedavi protokolü ve tüm seansları kalıcı olarak silinecek. Emin misiniz?',
      confirmText: 'Sil',
      variant: 'danger',
    })
    if (!ok) return
    try {
      const res = await fetch(`/api/protocols/${protocolId}`, { method: 'DELETE' })
      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: json.error || 'Silinemedi' } }))
        return
      }
      fetchProtocols()
      if (selectedProtocol?.id === protocolId) setSelectedProtocol(null)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Bağlantı hatası' } }))
    }
  }

  // Filter
  const filtered = protocols.filter(p => {
    if (search) {
      const q = search.toLowerCase()
      const customerName = (Array.isArray(p.customer) ? p.customer[0] : p.customer)?.name?.toLowerCase() || ''
      const protocolName = p.name.toLowerCase()
      if (!customerName.includes(q) && !protocolName.includes(q)) return false
    }
    return true
  })

  if (ctxLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="h-page">Tedavi Protokolleri</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Seans bazlı tedavi planları oluşturun ve takip edin</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Yeni Protokol
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text" placeholder="Hasta veya protokol ara..."
            className="input pl-10 w-full" value={search} onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'active', 'paused', 'completed', 'cancelled'] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={cn('badge px-3 py-1.5 cursor-pointer transition-colors', statusFilter === s
                ? 'bg-gray-900 dark:bg-gray-700 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
              {s === 'all' ? 'Tümü' : PROTOCOL_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3">
        {loading ? (
          <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ClipboardCheck className="h-8 w-8" />}
            title="Henüz tedavi protokolü yok"
            action={{ label: 'İlk Protokolü Oluştur', onClick: () => setShowCreate(true), icon: <Plus className="h-4 w-4" /> }}
          />
        ) : (
          filtered.map(p => {
            const customer = Array.isArray(p.customer) ? p.customer[0] : p.customer
            const service = Array.isArray(p.service) ? p.service[0] : p.service
            const progress = p.total_sessions > 0 ? (p.completed_sessions / p.total_sessions) * 100 : 0
            const statusBadge = STATUS_BADGE[p.status]
            const isSelected = selectedProtocol?.id === p.id

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProtocol(p)}
                className={`card p-4 cursor-pointer transition-all min-h-[140px] flex flex-col ${
                  isSelected ? 'ring-2 ring-pulse-900 shadow-md' : 'hover:shadow-sm'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5 truncate">
                      <User className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{customer?.name || '—'}</span>
                    </p>
                  </div>
                  <span className={statusBadge}>
                    {PROTOCOL_STATUS_LABELS[p.status]}
                  </span>
                </div>

                {/* Hizmet — her zaman slot, boşsa "—" */}
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1 truncate">
                  <Activity className="h-3 w-3 flex-shrink-0" /> <span className="truncate">{service?.name || '—'}</span>
                </p>

                {/* Progress bar — alta yasla */}
                <div className="mt-auto">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-pulse-900 h-2 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {p.completed_sessions}/{p.total_sessions}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-gray-400">{p.interval_days} gün aralık</span>
                    <ChevronRight className="h-4 w-4 text-gray-300" />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      {/* Detail Panel — Slide-over */}
      {(selectedProtocol || isClosingDetail) && selectedProtocol && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[110] ${isClosingDetail ? 'closing' : ''}`} onClick={closeDetail} onAnimationEnd={() => { if (isClosingDetail) { setSelectedProtocol(null); setIsClosingDetail(false) } }} />
          <div className={`slide-panel fixed inset-y-0 right-0 z-[110] w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto ${isClosingDetail ? 'closing' : ''}`}>
            <div className="p-6 space-y-6">
              <DetailPanel
                protocol={selectedProtocol}
                businessId={businessId!}
                onClose={closeDetail}
                onUpdateStatus={updateProtocolStatus}
                onUpdateSession={updateSession}
                onDelete={handleDelete}
                onRefresh={refreshProtocol}
              />
            </div>
          </div>
        </Portal>
      )}

      {/* Create Modal */}
      {(showCreate || isClosingCreate) && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[60] ${isClosingCreate ? 'closing' : ''}`} onClick={() => { closeCreate(); resetForm() }} onAnimationEnd={() => { if (isClosingCreate) { setShowCreate(false); setIsClosingCreate(false) } }} />
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 pointer-events-none">
          <div className={`modal-content bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto ${isClosingCreate ? 'closing' : ''}`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="h-section">Yeni Tedavi Protokolü</h2>
              <button onClick={() => { closeCreate(); resetForm() }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Hasta *</label>
                <CustomerSearchSelect
                  value={formCustomerId}
                  onChange={v => setFormCustomerId(v)}
                  businessId={businessId!}
                  placeholder="Hasta seçin..."
                />
              </div>
              <div>
                <label className="label">Protokol Adı *</label>
                <input className="input w-full" placeholder="Örn: Lazer Epilasyon Paketi" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="label">Hizmet</label>
                <CustomSelect
                  options={services.map(s => ({ value: s.id, label: `${s.name}${s.price ? ` — ${formatCurrency(s.price)}` : ''}` }))}
                  value={formServiceId}
                  onChange={v => setFormServiceId(v)}
                  placeholder="Hizmet seçin (opsiyonel)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Seans Sayısı *</label>
                  <input type="number" className="input w-full" min={1} max={50} value={formSessions} onChange={e => setFormSessions(Number(e.target.value))} />
                </div>
                <div>
                  <label className="label">Seans Aralığı (gün)</label>
                  <input type="number" className="input w-full" min={1} max={90} value={formInterval} onChange={e => setFormInterval(Number(e.target.value))} />
                </div>
              </div>
              <div>
                <label className="label">Notlar</label>
                <textarea className="input w-full" rows={3} placeholder={getTreatmentNotesPlaceholder(sector)} value={formNotes} onChange={e => setFormNotes(e.target.value)} />
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => { closeCreate(); resetForm() }} className="btn-secondary">İptal</button>
              <button onClick={handleCreate} disabled={saving || !formCustomerId || !formName} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Plus className="h-4 w-4 mr-1 inline" />}
                Oluştur
              </button>
            </div>
          </div>
          </div>
        </Portal>
      )}

      {/* Protokol tamamlandığında follow-up teklif modal'ı */}
      {followUpTarget && businessId && (
        <FollowUpQuickModal
          open={!!followUpTarget}
          onClose={() => setFollowUpTarget(null)}
          businessId={businessId}
          customerId={followUpTarget.customerId}
          customerName={followUpTarget.customerName}
          protocolId={followUpTarget.protocolId}
          defaultType="protocol_completion"
          defaultDaysOffset={7}
        />
      )}
    </div>
  )
}

// Detail panel component
function DetailPanel({
  protocol, businessId, onClose, onUpdateStatus, onUpdateSession, onDelete, onRefresh
}: {
  protocol: TreatmentProtocol
  businessId: string
  onClose: () => void
  onUpdateStatus: (id: string, status: ProtocolStatus) => void
  onUpdateSession: (protocolId: string, sessionId: string, status: SessionStatus) => void
  onDelete: (id: string) => void
  onRefresh: (protocolId: string) => void
}) {
  const [uploadingPhoto, setUploadingPhoto] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pendingUpload = useRef<{ sessionId: string; type: 'before' | 'after' } | null>(null)

  // Session notes inline edit
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [savingNote, setSavingNote] = useState(false)

  const customer = Array.isArray(protocol.customer) ? protocol.customer[0] : protocol.customer
  const service = Array.isArray(protocol.service) ? protocol.service[0] : protocol.service
  const sessions = (protocol.sessions || []).sort((a, b) => a.session_number - b.session_number)
  const progress = protocol.total_sessions > 0 ? (protocol.completed_sessions / protocol.total_sessions) * 100 : 0
  const statusBadge = STATUS_BADGE[protocol.status]

  function triggerPhotoUpload(sessionId: string, type: 'before' | 'after') {
    pendingUpload.current = { sessionId, type }
    fileInputRef.current?.click()
  }

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingUpload.current) return
    const { sessionId, type } = pendingUpload.current
    const uploadKey = `${sessionId}-${type}`
    setUploadingPhoto(uploadKey)

    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop()
      const path = `${businessId}/protocols/${protocol.id}/${sessionId}_${type}_${Date.now()}.${ext}`
      const { error: storageError } = await supabase.storage.from('customer-photos').upload(path, file)
      if (storageError) { console.error(storageError); return }

      const { data: { publicUrl } } = supabase.storage.from('customer-photos').getPublicUrl(path)

      await fetch(`/api/protocols/${protocol.id}/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          sessionId,
          ...(type === 'before' ? { beforePhotoUrl: publicUrl } : { afterPhotoUrl: publicUrl }),
        }),
      })

      // Refresh protocol detail + list
      onRefresh(protocol.id)
    } catch (err) {
      console.error('Fotoğraf yükleme hatası:', err)
    } finally {
      setUploadingPhoto(null)
      pendingUpload.current = null
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  function openNoteEditor(sessionId: string, currentNote: string | null) {
    setEditingNoteId(sessionId)
    setNoteText(currentNote || '')
  }

  async function saveNote(sessionId: string) {
    setSavingNote(true)
    try {
      await fetch(`/api/protocols/${protocol.id}/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, notes: noteText }),
      })
      setEditingNoteId(null)
      onRefresh(protocol.id)
    } catch { /* ignore */ } finally {
      setSavingNote(false)
    }
  }

  return (
    <>
      {/* Hidden file input for photo uploads */}
      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="h-section">{protocol.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {customer?.name || '—'}
            </span>
            {service && (
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" /> {service.name}
              </span>
            )}
            <span className={statusBadge}>
              {PROTOCOL_STATUS_LABELS[protocol.status]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">İlerleme</span>
          <span className="font-medium text-gray-900 dark:text-white">{protocol.completed_sessions}/{protocol.total_sessions} seans</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
          <div className="bg-pulse-900 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Actions */}
      {protocol.status === 'active' && (
        <div className="flex gap-2">
          <button onClick={() => onUpdateStatus(protocol.id, 'paused')} className="btn-secondary text-sm flex items-center gap-1">
            <Pause className="h-3.5 w-3.5" /> Duraklat
          </button>
          <button onClick={() => onUpdateStatus(protocol.id, 'completed')} className="btn-primary text-sm flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" /> Tamamla
          </button>
          <button onClick={() => onUpdateStatus(protocol.id, 'cancelled')} className="btn-danger text-sm flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" /> İptal
          </button>
        </div>
      )}
      {protocol.status === 'paused' && (
        <button onClick={() => onUpdateStatus(protocol.id, 'active')} className="btn-primary text-sm flex items-center gap-1 w-fit">
          <Play className="h-3.5 w-3.5" /> Devam Ettir
        </button>
      )}

      {/* Sessions Timeline */}
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Seans Takvimi</h3>
        <div className="space-y-3">
          {sessions.map((session, idx) => {
            const ssc = SESSION_STATUS_CONFIG[session.status as SessionStatus] || SESSION_STATUS_CONFIG.planned
            const Icon = ssc.icon
            return (
              <div key={session.id} className={`flex items-start gap-3 p-3 rounded-lg ${ssc.bg}`}>
                <div className="flex flex-col items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${ssc.text} bg-white dark:bg-gray-900 shadow-sm`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  {idx < sessions.length - 1 && <div className="w-px h-6 bg-gray-200 dark:bg-gray-700 mt-1" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-900 dark:text-white">
                      Seans {session.session_number}
                    </span>
                    <span className={`text-xs ${ssc.text}`}>
                      {SESSION_STATUS_LABELS[session.status as SessionStatus]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {session.planned_date && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(session.planned_date).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                    {session.completed_date && (
                      <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        {new Date(session.completed_date).toLocaleDateString('tr-TR')}
                      </span>
                    )}
                  </div>
                  {/* Session notes */}
                  {editingNoteId === session.id ? (
                    <div className="mt-2 space-y-1.5">
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        rows={2}
                        placeholder="Seans notu yazın..."
                        className="w-full text-xs rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-pulse-900 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => saveNote(session.id)}
                          disabled={savingNote}
                          className="text-xs px-2 py-1 rounded bg-pulse-900 text-white hover:bg-pulse-800 transition-colors disabled:opacity-50 flex items-center gap-1"
                        >
                          {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          Kaydet
                        </button>
                        <button
                          onClick={() => setEditingNoteId(null)}
                          className="text-xs px-2 py-1 rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          İptal
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5">
                      {session.notes ? (
                        <button
                          onClick={() => openNoteEditor(session.id, session.notes)}
                          className="group/note flex items-start gap-1.5 text-left"
                        >
                          <MessageSquare className="h-3 w-3 text-gray-400 mt-0.5 flex-shrink-0" />
                          <span className="text-xs text-gray-500 dark:text-gray-400 group-hover/note:text-gray-700 dark:group-hover/note:text-gray-200 transition-colors">
                            {session.notes}
                          </span>
                          <Pencil className="h-3 w-3 text-gray-300 dark:text-gray-600 opacity-0 group-hover/note:opacity-100 transition-opacity mt-0.5 flex-shrink-0" />
                        </button>
                      ) : (
                        <button
                          onClick={() => openNoteEditor(session.id, null)}
                          className="text-xs text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300 flex items-center gap-1 transition-colors"
                        >
                          <Plus className="h-3 w-3" /> Not ekle
                        </button>
                      )}
                    </div>
                  )}

                  {/* Session photos */}
                  <div className="flex gap-3 mt-2">
                    {/* Before photo */}
                    <div className="flex flex-col items-center gap-1">
                      {session.before_photo_url ? (
                        <div className="relative group/photo">
                          <Image src={session.before_photo_url} alt="Öncesi" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                          <button
                            onClick={() => triggerPhotoUpload(session.id, 'before')}
                            className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Camera className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => triggerPhotoUpload(session.id, 'before')}
                          disabled={uploadingPhoto === `${session.id}-before`}
                          className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-0.5
                                     hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors disabled:opacity-50"
                        >
                          {uploadingPhoto === `${session.id}-before`
                            ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            : <Upload className="h-4 w-4 text-gray-400" />}
                        </button>
                      )}
                      <span className="text-[10px] text-gray-400">Öncesi</span>
                    </div>

                    {/* After photo */}
                    <div className="flex flex-col items-center gap-1">
                      {session.after_photo_url ? (
                        <div className="relative group/photo">
                          <Image src={session.after_photo_url} alt="Sonrası" width={64} height={64} className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
                          <button
                            onClick={() => triggerPhotoUpload(session.id, 'after')}
                            className="absolute inset-0 bg-black/40 rounded-lg opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center"
                          >
                            <Camera className="h-4 w-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => triggerPhotoUpload(session.id, 'after')}
                          disabled={uploadingPhoto === `${session.id}-after`}
                          className="w-16 h-16 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex flex-col items-center justify-center gap-0.5
                                     hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/10 transition-colors disabled:opacity-50"
                        >
                          {uploadingPhoto === `${session.id}-after`
                            ? <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                            : <Upload className="h-4 w-4 text-gray-400" />}
                        </button>
                      )}
                      <span className="text-[10px] text-gray-400">Sonrası</span>
                    </div>
                  </div>

                  {/* Session actions */}
                  {session.status === 'planned' && protocol.status === 'active' && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => onUpdateSession(protocol.id, session.id, 'completed')}
                        className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                        Tamamla
                      </button>
                      <button
                        onClick={() => onUpdateSession(protocol.id, session.id, 'skipped')}
                        className="text-xs px-2 py-1 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 transition-colors">
                        Atla
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Notes */}
      {protocol.notes && (
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-1">
            <FileText className="h-4 w-4" /> Notlar
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">{protocol.notes}</p>
        </div>
      )}

      {/* Delete */}
      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onDelete(protocol.id)}
          className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors">
          Protokolü sil
        </button>
      </div>
    </>
  )
}
