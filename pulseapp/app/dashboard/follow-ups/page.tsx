'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requireSectorModule } from '@/lib/hooks/use-require-permission'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import {
  Plus, ClipboardCheck, Search, Loader2, Calendar, Send, Ban, Clock, CheckCircle, XCircle, X
} from 'lucide-react'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { Portal } from '@/components/ui/portal'
import { Pagination } from '@/components/ui/pagination'

interface FollowUp {
  id: string
  business_id: string
  appointment_id: string | null
  customer_id: string
  protocol_id: string | null
  type: 'post_session' | 'next_session_reminder' | 'protocol_completion' | 'package_sold' | 'manual'
  scheduled_for: string
  status: 'pending' | 'sent' | 'cancelled'
  message: string | null
  created_at: string
  customers?: { name: string; phone: string } | null
}

const TYPE_LABELS: Record<string, string> = {
  post_session: 'Seans Sonrası',
  next_session_reminder: 'Sonraki Seans Hatırlatma',
  protocol_completion: 'Protokol Tamamlandı',
  package_sold: 'Paket Satıldı',
  manual: 'Özel Takip',
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  sent: 'Gönderildi',
  cancelled: 'İptal',
}

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: typeof Clock }> = {
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
  sent: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle },
  cancelled: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', icon: XCircle },
}

export default function FollowUpsPage() {
  const { businessId, sector, loading: ctxLoading } = useBusinessContext()
  requireSectorModule(sector, 'follow-ups')
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
  const [sentCount, setSentCount] = useState(0)

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [closingCreate, setClosingCreate] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formType, setFormType] = useState<string>('post_session')
  const [formDate, setFormDate] = useState('')
  const [formMessage, setFormMessage] = useState('')

  const fetchFollowUps = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      let query = supabase
        .from('follow_up_queue')
        .select('*, customers(name, phone)', { count: 'exact' })
        .eq('business_id', businessId)
        .order('scheduled_for', { ascending: true })

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }

      query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

      const [{ data, count }, { count: pCount }, { count: sCount }] = await Promise.all([
        query,
        supabase.from('follow_up_queue').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'pending'),
        supabase.from('follow_up_queue').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('status', 'sent'),
      ])
      setFollowUps((data as FollowUp[]) || [])
      if (count !== null) setTotalCount(count)
      setPendingCount(pCount ?? 0)
      setSentCount(sCount ?? 0)
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [businessId, statusFilter, page])

  useEffect(() => { fetchFollowUps() }, [fetchFollowUps])

  useEffect(() => { setPage(0) }, [statusFilter])

  const statsTotal = totalCount

  const handleCreate = async () => {
    if (!businessId || !formCustomerId || !formDate) return
    setSaving(true)
    try {
      const { error } = await supabase.from('follow_up_queue').insert({
        business_id: businessId,
        customer_id: formCustomerId,
        type: formType,
        scheduled_for: new Date(formDate).toISOString(),
        status: 'pending',
        message: formMessage || null,
      })
      if (error) {
        console.error('Follow-up insert error:', error)
        toast.error('Takip oluşturulamadı', { description: error.message })
        return
      }
      toast.success('Takip başarıyla oluşturuldu')
      setShowCreate(false)
      resetForm()
      fetchFollowUps()
    } catch (err) {
      console.error('Follow-up creation error:', err)
      toast.error('Takip oluşturulamadı', { description: 'Bağlantı hatası' })
    } finally { setSaving(false) }
  }

  const resetForm = () => {
    setFormCustomerId('')
    setFormType('post_session')
    setFormDate('')
    setFormMessage('')
  }

  const handleMarkSent = async (id: string) => {
    await supabase.from('follow_up_queue').update({ status: 'sent' }).eq('id', id)
    fetchFollowUps()
  }

  const handleCancel = async (id: string) => {
    await supabase.from('follow_up_queue').update({ status: 'cancelled' }).eq('id', id)
    fetchFollowUps()
  }

  const filtered = followUps.filter(f => {
    if (!search) return true
    const q = search.toLowerCase()
    const customerName = f.customers?.name?.toLowerCase() || ''
    const msg = f.message?.toLowerCase() || ''
    return customerName.includes(q) || msg.includes(q)
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
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{statsTotal}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Bekleyen</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Gönderilen</p>
          <p className="text-2xl font-bold text-green-600">{sentCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Ara..." className="input pl-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'sent', 'cancelled'] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`badge px-3 py-1.5 cursor-pointer transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 dark:bg-gray-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              {s === 'all' ? 'Tümü' : STATUS_LABELS[s]}
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
              <AnimatedItem key={f.id} className="card p-4">
                <div className="flex items-center gap-4">
                  {/* Customer */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {f.customers?.name || 'Bilinmeyen'}
                    </p>
                    {f.customers?.phone && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">{f.customers.phone}</p>
                    )}
                  </div>

                  {/* Type */}
                  <div className="flex-shrink-0">
                    <span className="text-xs px-2 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                      {TYPE_LABELS[f.type] || f.type}
                    </span>
                  </div>

                  {/* Scheduled date */}
                  <div className="flex-shrink-0 text-right flex flex-col justify-center leading-tight">
                    <p className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1 justify-end">
                      <Calendar className="h-3.5 w-3.5 text-gray-400" />
                      {new Date(f.scheduled_for).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(f.scheduled_for).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>

                  {/* Status */}
                  <div className="flex-shrink-0">
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <Icon className="h-3 w-3" /> {STATUS_LABELS[f.status]}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-1">
                    {f.status === 'pending' && (
                      <>
                        <button
                          onClick={() => handleMarkSent(f.id)}
                          className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors flex items-center gap-1"
                          title="Gönderildi olarak işaretle"
                        >
                          <Send className="h-3 w-3" /> Gönder
                        </button>
                        <button
                          onClick={() => handleCancel(f.id)}
                          className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-1"
                          title="İptal et"
                        >
                          <Ban className="h-3 w-3" /> İptal
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Message */}
                {f.message && (
                  <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 pl-1 border-l-2 border-gray-200 dark:border-gray-700 ml-1">
                    {f.message}
                  </p>
                )}
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      )}

      {/* Pagination */}
      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      {/* Create Modal */}
      {(showCreate || closingCreate) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingCreate ? 'closing' : ''}`} onClick={() => setClosingCreate(true)} onAnimationEnd={() => { if (closingCreate) { setShowCreate(false); setClosingCreate(false); resetForm() } }}>
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
                  options={Object.entries(TYPE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                  value={formType}
                  onChange={v => setFormType(v)}
                  placeholder="Tip seçin"
                />
              </div>
              <div>
                <label className="label label-required">Planlanan Tarih</label>
                <input
                  type="datetime-local"
                  className="input w-full"
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Mesaj (opsiyonel)</label>
                <textarea
                  className="input w-full"
                  rows={3}
                  placeholder="Takip mesajı..."
                  value={formMessage}
                  onChange={e => setFormMessage(e.target.value)}
                />
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
    </div>
  )
}
