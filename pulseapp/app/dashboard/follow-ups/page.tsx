'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, ClipboardCheck, Search, Loader2, Calendar, Send, Ban, Clock, CheckCircle, XCircle,
  X, MessageCircle, MessageSquare, CalendarClock, User, FileText, ExternalLink, History, Save
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { Portal } from '@/components/ui/portal'
import { Pagination } from '@/components/ui/pagination'
import { FOLLOW_UP_TYPE_LABELS, FOLLOW_UP_STATUS_LABELS, type FollowUpType, type FollowUpStatus, type FollowUpStatusHistoryEntry } from '@/types'

interface FollowUp {
  id: string
  business_id: string
  appointment_id: string | null
  customer_id: string
  protocol_id: string | null
  customer_package_id: string | null
  type: FollowUpType
  scheduled_for: string
  status: FollowUpStatus
  message: string | null
  notes: string | null
  status_history: FollowUpStatusHistoryEntry[] | null
  created_at: string
  customers?: { id: string; name: string; phone: string } | null
  appointments?: { id: string; appointment_date: string; start_time: string } | null
  treatment_protocols?: { id: string; name: string } | null
}

const STATUS_CONFIG: Record<FollowUpStatus, { bg: string; text: string; icon: typeof Clock }> = {
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
  in_progress: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', icon: MessageCircle },
  sent: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-600 dark:text-indigo-400', icon: Send },
  no_response: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-600 dark:text-orange-400', icon: MessageSquare },
  done: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle },
  rescheduled: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-600 dark:text-purple-400', icon: CalendarClock },
  cancelled: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', icon: XCircle },
}

const ALL_STATUSES: FollowUpStatus[] = ['pending', 'in_progress', 'sent', 'no_response', 'done', 'rescheduled', 'cancelled']

function formatDateTime(iso: string) {
  const d = new Date(iso)
  return `${d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`
}

export default function FollowUpsPage() {
  const { businessId, sector, staffId, staffName, loading: ctxLoading, permissions } = useBusinessContext()
  requireSectorModule(sector, 'follow-ups')
  requirePermission(permissions, 'follow_ups')
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)
  const supabase = createClient()

  const PAGE_SIZE = 50
  const [followUps, setFollowUps] = useState<FollowUp[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [doneCount, setDoneCount] = useState(0)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [closingCreate, setClosingCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formType, setFormType] = useState<FollowUpType>('post_session')
  const [formDate, setFormDate] = useState('')
  const [formMessage, setFormMessage] = useState('')

  // Detail modal
  const [detailItem, setDetailItem] = useState<FollowUp | null>(null)
  const [closingDetail, setClosingDetail] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [editDate, setEditDate] = useState('')
  const [editMessage, setEditMessage] = useState('')
  const [editType, setEditType] = useState<FollowUpType>('manual')
  const [editNotes, setEditNotes] = useState('')
  const [statusNote, setStatusNote] = useState('')
  const [savingDetail, setSavingDetail] = useState(false)

  const fetchFollowUps = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      let query = supabase
        .from('follow_up_queue')
        .select('*, customers(id, name, phone), appointments(id, appointment_date, start_time), treatment_protocols(id, name)', { count: 'exact' })
        .eq('business_id', businessId)
        .order('scheduled_for', { ascending: true })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const [{ data, count }, { count: pCount }, { count: dCount }] = await Promise.all([
        query,
        supabase.from('follow_up_queue').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'pending'),
        supabase.from('follow_up_queue').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'done'),
      ])
      setFollowUps((data as FollowUp[]) || [])
      if (count !== null) setTotalCount(count)
      setPendingCount(pCount ?? 0)
      setDoneCount(dCount ?? 0)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [businessId, statusFilter, page, supabase])

  useEffect(() => { fetchFollowUps() }, [fetchFollowUps])
  useEffect(() => { setPage(0) }, [statusFilter])

  // ESC to close modals
  useEffect(() => {
    if (!detailItem && !showCreate) return
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (detailItem) setClosingDetail(true)
        else if (showCreate) setClosingCreate(true)
      }
    }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [detailItem, showCreate])

  const resetForm = () => {
    setFormCustomerId('')
    setFormType('post_session')
    setFormDate('')
    setFormMessage('')
  }

  const handleCreate = async () => {
    if (!businessId || !formCustomerId || !formDate) return
    setSaving(true)
    try {
      const initialHistory: FollowUpStatusHistoryEntry[] = [{
        status: 'pending',
        changed_at: new Date().toISOString(),
        staff_id: staffId,
        staff_name: staffName,
      }]
      const { error } = await supabase.from('follow_up_queue').insert({
        business_id: businessId,
        customer_id: formCustomerId,
        type: formType,
        scheduled_for: new Date(formDate).toISOString(),
        status: 'pending',
        message: formMessage || null,
        status_history: initialHistory,
      })
      if (error) {
        console.error('Follow-up insert error:', error)
        toast.error('Takip oluşturulamadı', { description: error.message })
        return
      }
      toast.success('Takip oluşturuldu')
      setClosingCreate(true)
      fetchFollowUps()
    } catch (err) {
      console.error(err)
      toast.error('Takip oluşturulamadı', { description: 'Bağlantı hatası' })
    } finally { setSaving(false) }
  }

  const openDetail = (item: FollowUp) => {
    setDetailItem(item)
    setEditMode(false)
    setStatusNote('')
    // Prefill edit fields
    const dt = new Date(item.scheduled_for)
    const pad = (n: number) => String(n).padStart(2, '0')
    const localIso = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
    setEditDate(localIso)
    setEditMessage(item.message ?? '')
    setEditType(item.type)
    setEditNotes(item.notes ?? '')
  }

  const changeStatus = async (newStatus: FollowUpStatus) => {
    if (!detailItem) return
    setSavingDetail(true)
    try {
      const prevHistory = Array.isArray(detailItem.status_history) ? detailItem.status_history : []
      const entry: FollowUpStatusHistoryEntry = {
        status: newStatus,
        changed_at: new Date().toISOString(),
        staff_id: staffId,
        staff_name: staffName,
        note: statusNote.trim() || undefined,
      }
      const nextHistory = [...prevHistory, entry]
      const { error } = await supabase
        .from('follow_up_queue')
        .update({ status: newStatus, status_history: nextHistory })
        .eq('id', detailItem.id)
      if (error) throw error
      toast.success(`Durum: ${FOLLOW_UP_STATUS_LABELS[newStatus]}`)
      setDetailItem({ ...detailItem, status: newStatus, status_history: nextHistory })
      setStatusNote('')
      fetchFollowUps()
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Durum güncellenemedi'
      toast.error('Durum güncellenemedi', { description: msg })
    } finally { setSavingDetail(false) }
  }

  const saveEdit = async () => {
    if (!detailItem || !editDate) return
    setSavingDetail(true)
    try {
      const { error } = await supabase
        .from('follow_up_queue')
        .update({
          scheduled_for: new Date(editDate).toISOString(),
          message: editMessage || null,
          type: editType,
          notes: editNotes || null,
        })
        .eq('id', detailItem.id)
      if (error) throw error
      toast.success('Takip güncellendi')
      setDetailItem({
        ...detailItem,
        scheduled_for: new Date(editDate).toISOString(),
        message: editMessage || null,
        type: editType,
        notes: editNotes || null,
      })
      setEditMode(false)
      fetchFollowUps()
    } catch (err: unknown) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'Güncellenemedi'
      toast.error('Güncellenemedi', { description: msg })
    } finally { setSavingDetail(false) }
  }

  const filtered = followUps.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    const customerName = f.customers?.name?.toLowerCase() || ''
    const msg = f.message?.toLowerCase() || ''
    const notes = f.notes?.toLowerCase() || ''
    return customerName.includes(q) || msg.includes(q) || notes.includes(q)
  })

  if (ctxLoading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Takipler</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Seans sonrası takip ve hatırlatma kuyruğu</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Yeni Takip
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Bekleyen</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Tamamlanan</p>
          <p className="text-2xl font-bold text-green-600">{doneCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Ara..." className="input pl-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', ...ALL_STATUSES] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`badge px-3 py-1.5 cursor-pointer transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 dark:bg-gray-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              {s === 'all' ? 'Tümü' : FOLLOW_UP_STATUS_LABELS[s as FollowUpStatus]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <ClipboardCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Henüz takip kaydı yok</p>
        </div>
      ) : (
        <AnimatedList className="space-y-3">
          {filtered.map(f => {
            const sc = STATUS_CONFIG[f.status]
            const Icon = sc.icon
            return (
              <AnimatedItem key={f.id} className="card p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" onClick={() => openDetail(f)}>
                <div className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {f.customers?.name || 'Bilinmeyen'}
                    </p>
                    {f.customers?.phone && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{f.customers.phone}</p>
                    )}
                  </div>
                  <div className="flex-shrink-0">
                    <span className="badge-info">
                      {FOLLOW_UP_TYPE_LABELS[f.type] || f.type}
                    </span>
                  </div>
                  <div className="flex-shrink-0 text-right flex flex-col justify-center leading-tight">
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1 justify-end">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      {new Date(f.scheduled_for).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(f.scheduled_for).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <Icon className="h-3 w-3" /> {FOLLOW_UP_STATUS_LABELS[f.status]}
                    </span>
                  </div>
                </div>
                {f.message && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 pl-1 border-l-2 border-gray-200 dark:border-gray-700 ml-1 line-clamp-1">
                    {f.message}
                  </p>
                )}
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      )}

      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      {/* Create Modal */}
      {(showCreate || closingCreate) && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 ${closingCreate ? 'closing' : ''}`}
            onClick={() => setClosingCreate(true)}
            onAnimationEnd={() => { if (closingCreate) { setShowCreate(false); setClosingCreate(false); resetForm() } }}>
            <div className={`modal-content card w-full max-w-lg dark:bg-gray-900 ${closingCreate ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-medium">Yeni Takip</h3>
                <button onClick={() => setClosingCreate(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="label label-required">{customerLabel}</label>
                  <CustomerSearchSelect
                    value={formCustomerId}
                    onChange={v => setFormCustomerId(v)}
                    businessId={businessId!}
                    placeholder={`${customerLabel} seçin...`}
                  />
                </div>
                <div>
                  <label className="label label-required">Takip Tipi</label>
                  <CustomSelect
                    options={Object.entries(FOLLOW_UP_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                    value={formType}
                    onChange={v => setFormType(v as FollowUpType)}
                    placeholder="Tip seçin"
                  />
                </div>
                <div>
                  <label className="label label-required">Planlanan Tarih</label>
                  <input type="datetime-local" className="input w-full" value={formDate} onChange={e => setFormDate(e.target.value)} />
                </div>
                <div>
                  <label className="label">Mesaj (opsiyonel)</label>
                  <textarea className="input w-full" rows={3} placeholder="Takip mesajı..." value={formMessage} onChange={e => setFormMessage(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <button onClick={() => setClosingCreate(true)} className="btn-secondary">İptal</button>
                <button onClick={handleCreate} disabled={saving || !formCustomerId || !formDate} className="btn-primary disabled:opacity-50">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Plus className="h-4 w-4 mr-1 inline" />}
                  Oluştur
                </button>
              </div>
            </div>
          </div>
        </Portal>
      )}

      {/* Detail Modal */}
      {detailItem && (
        <Portal>
          <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 ${closingDetail ? 'closing' : ''}`}
            onClick={() => setClosingDetail(true)}
            onAnimationEnd={() => { if (closingDetail) { setDetailItem(null); setClosingDetail(false); setEditMode(false) } }}>
            <div className={`modal-content card w-full max-w-2xl max-h-[90vh] overflow-y-auto dark:bg-gray-900 ${closingDetail ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const sc = STATUS_CONFIG[detailItem.status]
                      const Icon = sc.icon
                      return (
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          <Icon className="h-3 w-3" /> {FOLLOW_UP_STATUS_LABELS[detailItem.status]}
                        </span>
                      )
                    })()}
                    <span className="badge-info">
                      {FOLLOW_UP_TYPE_LABELS[detailItem.type] || detailItem.type}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{detailItem.customers?.name || 'Bilinmeyen'}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatDateTime(detailItem.scheduled_for)}</p>
                </div>
                <button onClick={() => setClosingDetail(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg flex-shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Links */}
              <div className="flex flex-wrap gap-2 mb-4">
                {detailItem.customers?.id && (
                  <Link href={`/dashboard/customers?id=${detailItem.customers.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 inline-flex items-center gap-1.5 transition-colors">
                    <User className="h-3.5 w-3.5" /> {customerLabel} Profili
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                )}
                {detailItem.customers?.id && (
                  <Link href={`/dashboard/records?customerId=${detailItem.customers.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 inline-flex items-center gap-1.5 transition-colors">
                    <FileText className="h-3.5 w-3.5" /> Hasta Dosyaları
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                )}
                {detailItem.appointments?.id && (
                  <Link href={`/dashboard/appointments?id=${detailItem.appointments.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 inline-flex items-center gap-1.5 transition-colors">
                    <Calendar className="h-3.5 w-3.5" /> Randevu
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                )}
                {detailItem.treatment_protocols?.id && (
                  <Link href={`/dashboard/protocols?id=${detailItem.treatment_protocols.id}`} className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 inline-flex items-center gap-1.5 transition-colors">
                    <ClipboardCheck className="h-3.5 w-3.5" /> Protokol
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </Link>
                )}
              </div>

              {/* Content */}
              {!editMode ? (
                <div className="space-y-4">
                  {detailItem.message && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Mesaj</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{detailItem.message}</p>
                    </div>
                  )}
                  {detailItem.notes && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Not</p>
                      <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{detailItem.notes}</p>
                    </div>
                  )}

                  {/* Status actions */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Durumu Güncelle</p>
                    <input
                      type="text"
                      className="input w-full mb-2"
                      placeholder="Değişiklik için not (opsiyonel)"
                      value={statusNote}
                      onChange={e => setStatusNote(e.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                      {ALL_STATUSES.filter(s => s !== detailItem.status).map(s => {
                        const sc = STATUS_CONFIG[s]
                        const Icon = sc.icon
                        return (
                          <button key={s} onClick={() => changeStatus(s)} disabled={savingDetail}
                            className={`text-xs px-3 py-1.5 rounded-lg ${sc.bg} ${sc.text} hover:opacity-80 transition-opacity inline-flex items-center gap-1.5 disabled:opacity-40`}>
                            <Icon className="h-3.5 w-3.5" /> {FOLLOW_UP_STATUS_LABELS[s]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Status history */}
                  {Array.isArray(detailItem.status_history) && detailItem.status_history.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 flex items-center gap-1.5">
                        <History className="h-3.5 w-3.5" /> Durum Geçmişi
                      </p>
                      <div className="space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-3">
                        {[...detailItem.status_history].reverse().map((h, i) => {
                          const sc = STATUS_CONFIG[h.status]
                          return (
                            <div key={i} className="text-xs">
                              <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>{FOLLOW_UP_STATUS_LABELS[h.status]}</span>
                                <span className="text-gray-500 dark:text-gray-400">{formatDateTime(h.changed_at)}</span>
                                {h.staff_name && <span className="text-gray-400">· {h.staff_name}</span>}
                              </div>
                              {h.note && <p className="mt-1 text-gray-600 dark:text-gray-400 pl-1">{h.note}</p>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label">Takip Tipi</label>
                    <CustomSelect
                      options={Object.entries(FOLLOW_UP_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                      value={editType}
                      onChange={v => setEditType(v as FollowUpType)}
                      placeholder="Tip seçin"
                    />
                  </div>
                  <div>
                    <label className="label label-required">Planlanan Tarih</label>
                    <input type="datetime-local" className="input w-full" value={editDate} onChange={e => setEditDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Mesaj</label>
                    <textarea className="input w-full" rows={3} placeholder="Takip mesajı..." value={editMessage} onChange={e => setEditMessage(e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Dahili Not</label>
                    <textarea className="input w-full" rows={3} placeholder="Sadece ekip için..." value={editNotes} onChange={e => setEditNotes(e.target.value)} />
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-between gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button onClick={() => setClosingDetail(true)} className="btn-secondary inline-flex items-center gap-1.5">
                  <Ban className="h-4 w-4" /> Kapat
                </button>
                {editMode ? (
                  <div className="flex gap-2">
                    <button onClick={() => setEditMode(false)} className="btn-secondary">Vazgeç</button>
                    <button onClick={saveEdit} disabled={savingDetail || !editDate} className="btn-primary inline-flex items-center gap-1.5 disabled:opacity-50">
                      {savingDetail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Kaydet
                    </button>
                  </div>
                ) : (
                  <button onClick={() => setEditMode(true)} className="btn-primary inline-flex items-center gap-1.5">
                    Düzenle
                  </button>
                )}
              </div>
            </div>
          </div>
        </Portal>
      )}
    </div>
  )
}
