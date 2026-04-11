'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { createClient } from '@/lib/supabase/client'
import {
  Plus, ClipboardCheck, Search, X, Calendar, User, Activity,
  ChevronRight, Loader2, Pause, Play, CheckCircle, XCircle, SkipForward,
  Camera, FileText, Clock, Sparkles, Upload, MessageSquare, Pencil, Save,
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

const STATUS_CONFIG: Record<ProtocolStatus, { bg: string; text: string }> = {
  active: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400' },
  completed: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400' },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400' },
  paused: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400' },
}

const SESSION_STATUS_CONFIG: Record<SessionStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  planned: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500', icon: Clock },
  completed: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle },
  cancelled: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-600 dark:text-red-400', icon: XCircle },
  skipped: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', icon: SkipForward },
}

export default function ProtocolsPage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const { confirm } = useConfirm()

  // State
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedProtocol, setSelectedProtocol] = useState<TreatmentProtocol | null>(null)
  const [isClosingDetail, setIsClosingDetail] = useState(false)
  const closeDetail = () => setIsClosingDetail(true)

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
      setProtocols(json.protocols || [])
      setTotalCount(json.total || 0)
    } catch { /* ignore */ } finally { setLoading(false) }
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

  useEffect(() => {
    if (!showCreate) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCreate() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showCreate])

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
      }
    } catch { /* ignore */ } finally { setSaving(false) }
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
      await fetch(`/api/protocols/${protocolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, status }),
      })
      fetchProtocols()
      if (selectedProtocol?.id === protocolId) {
        setSelectedProtocol(prev => prev ? { ...prev, status } : null)
      }
    } catch { /* ignore */ }
  }

  // Update session
  const updateSession = async (protocolId: string, sessionId: string, status: SessionStatus) => {
    if (!businessId) return
    try {
      await fetch(`/api/protocols/${protocolId}/sessions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessId, sessionId, status }),
      })
      // Refresh list and detail in parallel
      const [, detailJson] = await Promise.all([
        fetchProtocols(),
        fetch(`/api/protocols/${protocolId}?businessId=${businessId}`).then(r => r.json()),
      ])
      if (detailJson.protocol) setSelectedProtocol(detailJson.protocol)
    } catch { /* ignore */ }
  }

  // Refresh single protocol (for photo uploads etc.)
  const refreshProtocol = useCallback(async (protocolId: string) => {
    if (!businessId) return
    try {
      const [, detailJson] = await Promise.all([
        fetchProtocols(),
        fetch(`/api/protocols/${protocolId}?businessId=${businessId}`).then(r => r.json()),
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
      await fetch(`/api/protocols/${protocolId}?businessId=${businessId}`, { method: 'DELETE' })
      fetchProtocols()
      if (selectedProtocol?.id === protocolId) setSelectedProtocol(null)
    } catch { /* ignore */ }
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Tedavi Protokolleri</h1>
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
          <div className="card p-8 text-center">
            <ClipboardCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400">Henüz tedavi protokolü yok</p>
            <button onClick={() => setShowCreate(true)} className="btn-primary mt-4 text-sm">
              <Plus className="h-4 w-4 mr-1 inline" /> İlk Protokolü Oluştur
            </button>
          </div>
        ) : (
          filtered.map(p => {
            const customer = Array.isArray(p.customer) ? p.customer[0] : p.customer
            const service = Array.isArray(p.service) ? p.service[0] : p.service
            const progress = p.total_sessions > 0 ? (p.completed_sessions / p.total_sessions) * 100 : 0
            const sc = STATUS_CONFIG[p.status]
            const isSelected = selectedProtocol?.id === p.id

            return (
              <div
                key={p.id}
                onClick={() => setSelectedProtocol(p)}
                className={`card p-4 cursor-pointer transition-all ${
                  isSelected ? 'ring-2 ring-pulse-900 shadow-md' : 'hover:shadow-sm'
                }`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">{p.name}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                      <User className="h-3 w-3" /> {customer?.name || '—'}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                    {PROTOCOL_STATUS_LABELS[p.status]}
                  </span>
                </div>

                {service && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 flex items-center gap-1">
                    <Activity className="h-3 w-3" /> {service.name}
                  </p>
                )}

                {/* Progress bar */}
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
            )
          })
        )}
      </div>

      {totalCount > PAGE_SIZE && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} / {totalCount}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
              Önceki
            </button>
            <button onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount} className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed">
              Sonraki
            </button>
          </div>
        </div>
      )}

      {/* Detail Panel — Slide-over */}
      {(selectedProtocol || isClosingDetail) && selectedProtocol && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[60] bg-black/40 dark:bg-black/60 ${isClosingDetail ? 'closing' : ''}`} onClick={closeDetail} onAnimationEnd={() => { if (isClosingDetail) { setSelectedProtocol(null); setIsClosingDetail(false) } }} />
          <div className={`slide-panel fixed inset-y-0 right-0 z-[61] w-full max-w-lg bg-white dark:bg-gray-900 shadow-2xl overflow-y-auto ${isClosingDetail ? 'closing' : ''}`}>
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
          <div className={`modal-overlay fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 ${isClosingCreate ? 'closing' : ''}`} onClick={() => { closeCreate(); resetForm() }} onAnimationEnd={() => { if (isClosingCreate) { setShowCreate(false); setIsClosingCreate(false) } }} />
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4 pointer-events-none">
          <div className={`modal-content bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto pointer-events-auto ${isClosingCreate ? 'closing' : ''}`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Yeni Tedavi Protokolü</h2>
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
                <textarea className="input w-full" rows={3} placeholder="Tedavi notları..." value={formNotes} onChange={e => setFormNotes(e.target.value)} />
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
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [showAi, setShowAi] = useState(false)
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
  const sc = STATUS_CONFIG[protocol.status]

  async function handleAiSuggestion() {
    if (!protocol.customer_id) return
    setAiLoading(true)
    setShowAi(true)
    setAiSuggestion(null)
    try {
      const res = await fetch('/api/ai/treatment-suggestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          customerId: protocol.customer_id,
          complaint: protocol.notes || undefined,
        }),
      })
      const json = await res.json()
      setAiSuggestion(res.ok ? json.suggestion : (json.error || 'AI yanıtı alınamadı'))
    } catch {
      setAiSuggestion('Beklenmeyen bir hata oluştu')
    } finally {
      setAiLoading(false)
    }
  }

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
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{protocol.name}</h2>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
              <User className="h-3.5 w-3.5" /> {customer?.name || '—'}
            </span>
            {service && (
              <span className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Activity className="h-3.5 w-3.5" /> {service.name}
              </span>
            )}
            <span className={`text-xs px-2.5 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
              {PROTOCOL_STATUS_LABELS[protocol.status]}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAiSuggestion}
            disabled={aiLoading || !protocol.customer_id}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                       bg-pulse-900/10 text-pulse-900 dark:text-pulse-300 dark:bg-pulse-900/15
                       hover:bg-pulse-900/20 dark:hover:bg-pulse-900/25 transition-colors
                       disabled:opacity-50"
            title="AI Tedavi Önerisi"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            AI Öneri
          </button>
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={session.before_photo_url} alt="Öncesi" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
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
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={session.after_photo_url} alt="Sonrası" className="w-16 h-16 rounded-lg object-cover border border-gray-200 dark:border-gray-700" />
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

      {/* AI Suggestion */}
      {showAi && (
        <div className="border border-pulse-200 dark:border-pulse-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 bg-pulse-900/5 dark:bg-pulse-900/10 border-b border-pulse-200 dark:border-pulse-800">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-pulse-900 dark:text-pulse-400" />
              <h3 className="font-semibold text-sm text-gray-900 dark:text-white">AI Tedavi Önerisi</h3>
            </div>
            <button onClick={() => setShowAi(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="p-4">
            {aiLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
                <span className="ml-2 text-sm text-gray-500">AI analiz yapıyor...</span>
              </div>
            ) : (
              <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {aiSuggestion}
              </div>
            )}
          </div>
        </div>
      )}

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
