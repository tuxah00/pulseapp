'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import {
  Plus, ClipboardCheck, Search, X, Calendar, User, Activity,
  ChevronRight, Loader2, Pause, Play, CheckCircle, XCircle, SkipForward,
  Camera, FileText, Clock
} from 'lucide-react'
import type {
  TreatmentProtocol, ProtocolSession, Customer, Service, ProtocolStatus, SessionStatus
} from '@/types'
import { PROTOCOL_STATUS_LABELS, SESSION_STATUS_LABELS } from '@/types'
import { formatCurrency } from '@/lib/utils'

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
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [selectedProtocol, setSelectedProtocol] = useState<TreatmentProtocol | null>(null)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
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
      const res = await fetch(`/api/protocols?${params}`)
      const json = await res.json()
      setProtocols(json.protocols || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [businessId, statusFilter])

  const fetchMeta = useCallback(async () => {
    if (!businessId) return
    const [custRes, svcRes] = await Promise.all([
      fetch(`/api/customers?businessId=${businessId}&limit=500`).then(r => r.json()).catch(() => ({ customers: [] })),
      fetch(`/api/services?businessId=${businessId}`).then(r => r.json()).catch(() => ({ services: [] })),
    ])
    setCustomers(custRes.customers || [])
    setServices(svcRes.services || [])
  }, [businessId])

  useEffect(() => { fetchProtocols() }, [fetchProtocols])
  useEffect(() => { fetchMeta() }, [fetchMeta])

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
        setShowCreate(false)
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
      fetchProtocols()
      // Refresh selected protocol
      const res = await fetch(`/api/protocols/${protocolId}?businessId=${businessId}`)
      const json = await res.json()
      if (json.protocol) setSelectedProtocol(json.protocol)
    } catch { /* ignore */ }
  }

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
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
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
        <div className="flex gap-1">
          {(['all', 'active', 'paused', 'completed', 'cancelled'] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
                statusFilter === s
                  ? 'bg-pulse-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}>
              {s === 'all' ? 'Tümü' : PROTOCOL_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Protocol List */}
        <div className={`${selectedProtocol ? 'lg:col-span-1' : 'lg:col-span-3'} space-y-3`}>
          {loading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-500" /></div>
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
              const sessions = p.sessions || []
              const progress = p.total_sessions > 0 ? (p.completed_sessions / p.total_sessions) * 100 : 0
              const sc = STATUS_CONFIG[p.status]
              const isSelected = selectedProtocol?.id === p.id

              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedProtocol(p)}
                  className={`card p-4 cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-pulse-500 shadow-md' : 'hover:shadow-sm'
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
                        className="bg-pulse-500 h-2 rounded-full transition-all"
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

        {/* Detail Panel */}
        {selectedProtocol && (
          <div className="lg:col-span-2 card p-6 space-y-6">
            <DetailPanel
              protocol={selectedProtocol}
              onClose={() => setSelectedProtocol(null)}
              onUpdateStatus={updateProtocolStatus}
              onUpdateSession={updateSession}
              onDelete={handleDelete}
            />
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Yeni Tedavi Protokolü</h2>
              <button onClick={() => { setShowCreate(false); resetForm() }} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Hasta *</label>
                <select className="input w-full" value={formCustomerId} onChange={e => setFormCustomerId(e.target.value)}>
                  <option value="">Hasta seçin</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Protokol Adı *</label>
                <input className="input w-full" placeholder="Örn: Lazer Epilasyon Paketi" value={formName} onChange={e => setFormName(e.target.value)} />
              </div>
              <div>
                <label className="label">Hizmet</label>
                <select className="input w-full" value={formServiceId} onChange={e => setFormServiceId(e.target.value)}>
                  <option value="">Hizmet seçin (opsiyonel)</option>
                  {services.map(s => <option key={s.id} value={s.id}>{s.name}{s.price ? ` — ${formatCurrency(s.price)}` : ''}</option>)}
                </select>
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
              <button onClick={() => { setShowCreate(false); resetForm() }} className="btn-secondary">İptal</button>
              <button onClick={handleCreate} disabled={saving || !formCustomerId || !formName} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Plus className="h-4 w-4 mr-1 inline" />}
                Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Detail panel component
function DetailPanel({
  protocol, onClose, onUpdateStatus, onUpdateSession, onDelete
}: {
  protocol: TreatmentProtocol
  onClose: () => void
  onUpdateStatus: (id: string, status: ProtocolStatus) => void
  onUpdateSession: (protocolId: string, sessionId: string, status: SessionStatus) => void
  onDelete: (id: string) => void
}) {
  const customer = Array.isArray(protocol.customer) ? protocol.customer[0] : protocol.customer
  const service = Array.isArray(protocol.service) ? protocol.service[0] : protocol.service
  const sessions = (protocol.sessions || []).sort((a, b) => a.session_number - b.session_number)
  const progress = protocol.total_sessions > 0 ? (protocol.completed_sessions / protocol.total_sessions) * 100 : 0
  const sc = STATUS_CONFIG[protocol.status]

  return (
    <>
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
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1">
          <span className="text-gray-600 dark:text-gray-400">İlerleme</span>
          <span className="font-medium text-gray-900 dark:text-white">{protocol.completed_sessions}/{protocol.total_sessions} seans</span>
        </div>
        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-3">
          <div className="bg-pulse-500 h-3 rounded-full transition-all" style={{ width: `${progress}%` }} />
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
                  {session.notes && <p className="text-xs text-gray-500 mt-1">{session.notes}</p>}

                  {/* Session photos */}
                  <div className="flex gap-2 mt-1">
                    {session.before_photo_url && (
                      <span className="text-xs text-blue-500 flex items-center gap-0.5"><Camera className="h-3 w-3" /> Öncesi</span>
                    )}
                    {session.after_photo_url && (
                      <span className="text-xs text-green-500 flex items-center gap-0.5"><Camera className="h-3 w-3" /> Sonrası</span>
                    )}
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
