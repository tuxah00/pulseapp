'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Stethoscope, Search, Loader2, X, ChevronRight, Check, XCircle,
  MessageSquare, CalendarPlus, Trash2, RefreshCcw, Clock, User,
  Phone, Mail, AlertCircle, Image as ImageIcon, SlidersHorizontal,
  Send, ChevronDown, FileText, Info
} from 'lucide-react'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import EmptyState from '@/components/ui/empty-state'
import { Portal } from '@/components/ui/portal'
import { CustomSelect } from '@/components/ui/custom-select'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import type { ConsultationRequest, ConsultationStatus } from '@/types'

// ── Status tanımları ──
const STATUS_CONFIG: Record<ConsultationStatus, { label: string; color: string; bg: string }> = {
  pending:        { label: 'Bekliyor',       color: 'text-amber-700 dark:text-amber-300',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  reviewing:      { label: 'İnceleniyor',    color: 'text-blue-700 dark:text-blue-300',    bg: 'bg-blue-50 dark:bg-blue-900/20' },
  suitable:       { label: 'Uygun',          color: 'text-green-700 dark:text-green-300',  bg: 'bg-green-50 dark:bg-green-900/20' },
  not_suitable:   { label: 'Uygun Değil',    color: 'text-red-700 dark:text-red-300',      bg: 'bg-red-50 dark:bg-red-900/20' },
  needs_more_info:{ label: 'Ek Bilgi İstendi',color: 'text-purple-700 dark:text-purple-300',bg: 'bg-purple-50 dark:bg-purple-900/20' },
  converted:      { label: 'Dönüştürüldü',   color: 'text-teal-700 dark:text-teal-300',    bg: 'bg-teal-50 dark:bg-teal-900/20' },
  archived:       { label: 'Arşiv',          color: 'text-gray-500 dark:text-gray-400',    bg: 'bg-gray-100 dark:bg-gray-800' },
}

const FILTER_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'pending', label: 'Bekliyor' },
  { key: 'reviewing', label: 'İnceleniyor' },
  { key: 'needs_more_info', label: 'Ek Bilgi' },
  { key: 'suitable', label: 'Uygun' },
  { key: 'not_suitable', label: 'Uygun Değil' },
  { key: 'converted', label: 'Dönüştürüldü' },
  { key: 'archived', label: 'Arşiv' },
]

function StatusBadge({ status }: { status: ConsultationStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full', cfg.bg, cfg.color)}>
      {cfg.label}
    </span>
  )
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Ana Sayfa ──
export default function ConsultationsPage() {
  const { businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const { confirm } = useConfirm()
  requirePermission(permissions, 'consultations')

  const [items, setItems] = useState<ConsultationRequest[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selected, setSelected] = useState<ConsultationRequest | null>(null)
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelClosing, setPanelClosing] = useState(false)

  // Actions state
  const [actioning, setActioning] = useState(false)
  const [respondMsg, setRespondMsg] = useState('')
  const [respondDecision, setRespondDecision] = useState('')
  const [showRespondBox, setShowRespondBox] = useState(false)
  const [showConvertModal, setShowConvertModal] = useState(false)

  const fetchRef = useRef(0)
  const supabase = createClient()

  const fetchItems = useCallback(async () => {
    if (!businessId) return
    const id = ++fetchRef.current
    setLoading(true)
    try {
      const params = new URLSearchParams({ limit: '50', offset: '0' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (search) params.set('search', search)
      const res = await fetch(`/api/consultations?${params}`)
      if (!res.ok) return
      const d = await res.json()
      if (fetchRef.current !== id) return
      setItems(d.items ?? [])
      setTotal(d.total ?? 0)
      setCounts(d.counts ?? {})
    } finally {
      if (fetchRef.current === id) setLoading(false)
    }
  }, [businessId, statusFilter, search])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // Realtime: yeni konsültasyon talebi gelince banner + toast
  useEffect(() => {
    if (!businessId) return
    const channel = supabase
      .channel(`consultations:${businessId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'consultation_requests',
          filter: `business_id=eq.${businessId}`,
        },
        (payload) => {
          const row = payload.new as { full_name?: string }
          window.dispatchEvent(new CustomEvent('pulse-toast', {
            detail: {
              type: 'consultation_request',
              title: 'Yeni Ön Konsültasyon',
              body: `${row.full_name || 'Yeni hasta'} başvuru gönderdi.`,
            },
          }))
          // Listeyi yenile
          fetchItems()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId])

  // Panel aç/kapat
  function openPanel(item: ConsultationRequest) {
    setSelected(item)
    setShowRespondBox(false)
    setRespondMsg('')
    setRespondDecision('')
    setPanelClosing(false)
    setPanelOpen(true)
  }

  function closePanel() {
    setPanelClosing(true)
    setTimeout(() => { setPanelOpen(false); setPanelClosing(false); setSelected(null) }, 220)
  }

  // Status güncelle
  async function updateStatus(id: string, status: ConsultationStatus, decisionReason?: string) {
    setActioning(true)
    try {
      const res = await fetch(`/api/consultations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, decisionReason }),
      })
      if (res.ok) {
        await fetchItems()
        if (selected?.id === id) {
          setSelected(prev => prev ? { ...prev, status, decision_reason: decisionReason || prev.decision_reason } : prev)
        }
      }
    } finally { setActioning(false) }
  }

  // Yanıt gönder
  async function handleRespond() {
    if (!selected || !respondMsg.trim()) return
    setActioning(true)
    try {
      const res = await fetch(`/api/consultations/${selected.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: respondMsg.trim(),
          channel: 'auto',
          updateStatus: respondDecision as ConsultationStatus || undefined,
        }),
      })
      const d = await res.json()
      if (res.ok) {
        setRespondMsg(''); setShowRespondBox(false); setRespondDecision('')
        if (respondDecision) {
          setSelected(prev => prev ? { ...prev, status: respondDecision as ConsultationStatus } : prev)
          await fetchItems()
        }
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'system', title: 'Mesaj Gönderildi', body: `${d.channel?.toUpperCase()} ile iletildi.` } }))
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Gönderim Başarısız', body: d.error || 'Hata oluştu.' } }))
      }
    } finally { setActioning(false) }
  }

  // Sil
  async function handleDelete(item: ConsultationRequest) {
    const ok = await confirm({ title: 'Talebi Sil', message: `${item.full_name} adlı kişinin talebi kalıcı olarak silinecek. Devam edilsin mi?`, variant: 'danger', confirmText: 'Sil' })
    if (!ok) return
    const res = await fetch(`/api/consultations/${item.id}`, { method: 'DELETE' })
    if (res.ok) { closePanel(); await fetchItems() }
  }

  if (ctxLoading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-7 w-7 text-pulse-900 animate-spin" />
    </div>
  )

  const pendingCount = counts['pending'] || 0
  const reviewingCount = counts['reviewing'] || 0
  const convertedCount = counts['converted'] || 0
  const allCount = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ön Konsültasyon</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Hastalardan gelen ön değerlendirme talepleri</p>
        </div>
        <button
          onClick={fetchItems}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all"
        >
          <RefreshCcw className="h-4 w-4" /> Yenile
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Toplam', value: allCount, color: 'text-gray-900 dark:text-white' },
          { label: 'Bekleyen', value: pendingCount, color: 'text-amber-700 dark:text-amber-300' },
          { label: 'İnceleniyor', value: reviewingCount, color: 'text-blue-700 dark:text-blue-300' },
          { label: 'Dönüştürüldü', value: convertedCount, color: 'text-teal-700 dark:text-teal-300' },
        ].map(stat => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">{stat.label}</p>
            <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Status Tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                statusFilter === tab.key
                  ? 'bg-pulse-900 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
            >
              {tab.label}
              {tab.key !== 'all' && counts[tab.key] ? ` (${counts[tab.key]})` : ''}
            </button>
          ))}
        </div>

        {/* Arama */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Ad, telefon veya soru..."
            className="pl-9 pr-4 py-2 w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
          />
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 text-pulse-900 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Stethoscope className="h-8 w-8 text-gray-300 dark:text-gray-600" />}
          title="Henüz ön konsültasyon talebi yok"
          description="Formunuzu paylaşarak hastalardan değerlendirme talepleri alabilirsiniz."
        />
      ) : (
        <AnimatedList>
          {items.map(item => {
            const photoCount = (item.photo_urls as { url: string }[])?.length || 0
            return (
              <AnimatedItem key={item.id}>
                <div
                  onClick={() => openPanel(item)}
                  className="flex items-center gap-4 px-4 h-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 hover:border-pulse-900/30 hover:shadow-sm transition-all cursor-pointer"
                >
                  {/* Avatar */}
                  <div className="h-10 w-10 rounded-xl bg-pulse-900/10 dark:bg-pulse-900/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-pulse-900 dark:text-pulse-300">
                      {item.full_name.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  {/* Bilgiler — 2 satır sabit */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{item.full_name}</span>
                      <StatusBadge status={item.status} />
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                      {item.service_label || item.phone}
                    </p>
                  </div>

                  {/* Sağ blok — fotoğraf sayısı + tarih */}
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {photoCount > 0 && (
                      <span className="hidden sm:flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                        <ImageIcon className="h-3 w-3" />{photoCount}
                      </span>
                    )}
                    <span className="hidden md:block text-xs text-gray-400">{formatDate(item.created_at)}</span>
                    <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600" />
                  </div>
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      )}

      {/* ── Detay Paneli ── */}
      {panelOpen && selected && (
        <Portal>
          {/* Backdrop */}
          <div
            className={cn('fixed inset-0 bg-black/40 z-[60]', panelClosing ? 'animate-out fade-out' : 'modal-overlay')}
            onClick={closePanel}
          />
          {/* Panel */}
          <div className={cn(
            'fixed right-0 top-0 bottom-0 w-full sm:w-[480px] bg-white dark:bg-gray-900 z-[61] flex flex-col shadow-xl',
            panelClosing ? 'slide-panel closing' : 'slide-panel'
          )}>
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-pulse-900/10 dark:bg-pulse-900/20 flex items-center justify-center">
                  <span className="text-sm font-bold text-pulse-900 dark:text-pulse-300">
                    {selected.full_name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{selected.full_name}</h3>
                  <StatusBadge status={selected.status} />
                </div>
              </div>
              <button onClick={closePanel} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Panel İçerik */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-5 space-y-5">

                {/* Müşteri Bilgileri */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Kişisel Bilgiler</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-700 dark:text-gray-200">{selected.phone}</span>
                    </div>
                    {selected.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-200">{selected.email}</span>
                      </div>
                    )}
                    {selected.age && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-200">{selected.age} yaş</span>
                      </div>
                    )}
                    {(selected.service_label || (selected.service as { name?: string } | null)?.name) && (
                      <div className="flex items-center gap-2 text-sm">
                        <Stethoscope className="h-3.5 w-3.5 text-gray-400" />
                        <span className="text-gray-700 dark:text-gray-200">
                          {(selected.service as { name?: string } | null)?.name || selected.service_label}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span className="text-gray-500 dark:text-gray-400">{formatDate(selected.created_at)}</span>
                    </div>
                  </div>
                </div>

                {/* Soru */}
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Soru / Şikayet</h4>
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                    <p className="text-sm text-gray-700 dark:text-gray-200 leading-relaxed">{selected.question}</p>
                  </div>
                </div>

                {/* Sağlık Notları */}
                {selected.health_notes && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Sağlık Notları</h4>
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4">
                      <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">{selected.health_notes}</p>
                    </div>
                  </div>
                )}

                {/* Fotoğraflar */}
                {(selected.photo_urls as { url: string; path: string }[])?.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                      Fotoğraflar ({(selected.photo_urls as { url: string }[]).length})
                    </h4>
                    <div className="grid grid-cols-3 gap-2">
                      {(selected.photo_urls as { url: string; path: string }[]).map((p, i) => (
                        <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={p.url}
                            alt={`Fotoğraf ${i + 1}`}
                            className="aspect-square rounded-lg object-cover w-full hover:opacity-90 transition-opacity"
                          />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Karar Gerekçesi (varsa) */}
                {selected.decision_reason && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Karar Gerekçesi</h4>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4">
                      <p className="text-sm text-gray-700 dark:text-gray-200">{selected.decision_reason}</p>
                      {selected.reviewed_by_staff_name && (
                        <p className="text-xs text-gray-400 mt-1">— {selected.reviewed_by_staff_name}</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Aksiyon Butonları */}
                {!['converted', 'archived'].includes(selected.status) && (
                  <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Aksiyon</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        disabled={actioning}
                        onClick={() => updateStatus(selected.id, 'suitable')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <Check className="h-4 w-4" /> Uygun
                      </button>
                      <button
                        disabled={actioning}
                        onClick={() => updateStatus(selected.id, 'not_suitable')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" /> Uygun Değil
                      </button>
                      <button
                        disabled={actioning}
                        onClick={() => updateStatus(selected.id, 'needs_more_info')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium transition-all disabled:opacity-50"
                      >
                        <AlertCircle className="h-4 w-4" /> Ek Bilgi İste
                      </button>
                      <button
                        disabled={actioning}
                        onClick={() => updateStatus(selected.id, 'reviewing')}
                        className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 text-sm font-medium hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all disabled:opacity-50"
                      >
                        <RefreshCcw className="h-4 w-4" /> İnceleniyor
                      </button>
                    </div>

                    {/* Randevuya Çevir */}
                    {['suitable', 'needs_more_info', 'reviewing'].includes(selected.status) && (
                      <button
                        disabled={actioning}
                        onClick={() => setShowConvertModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-semibold transition-all disabled:opacity-50"
                      >
                        <CalendarPlus className="h-4 w-4" /> Randevuya Çevir
                      </button>
                    )}
                  </div>
                )}

                {/* Yanıt Composer */}
                <div className="space-y-2">
                  <button
                    onClick={() => setShowRespondBox(v => !v)}
                    className="flex items-center gap-2 text-xs font-medium text-pulse-900 dark:text-pulse-300 hover:opacity-80 transition-all"
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    {showRespondBox ? 'Yanıt kutusunu gizle' : 'Mesaj yaz ve gönder'}
                  </button>
                  {showRespondBox && (
                    <div className="space-y-2">
                      <textarea
                        value={respondMsg}
                        onChange={e => setRespondMsg(e.target.value)}
                        rows={4}
                        placeholder="Hastaya göndermek istediğiniz mesajı yazın..."
                        className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900 resize-none"
                      />
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <CustomSelect
                            value={respondDecision}
                            onChange={setRespondDecision}
                            options={[
                              { value: '', label: '— Status değişikliği yok —' },
                              { value: 'suitable', label: 'Uygun olarak işaretle' },
                              { value: 'not_suitable', label: 'Uygun değil olarak işaretle' },
                              { value: 'needs_more_info', label: 'Ek bilgi istendi' },
                            ]}
                          />
                        </div>
                        <button
                          onClick={handleRespond}
                          disabled={!respondMsg.trim() || actioning}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-all disabled:opacity-50"
                        >
                          {actioning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          Gönder
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Panel Footer */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
              <button
                onClick={() => updateStatus(selected.id, 'archived')}
                disabled={actioning || selected.status === 'archived'}
                className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 flex items-center gap-1 transition-all disabled:opacity-30"
              >
                <FileText className="h-3.5 w-3.5" /> Arşivle
              </button>
              <button
                onClick={() => handleDelete(selected)}
                disabled={actioning}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 transition-all disabled:opacity-30"
              >
                <Trash2 className="h-3.5 w-3.5" /> Sil
              </button>
            </div>
          </div>
        </Portal>
      )}

      {/* Randevuya Çevir Modal */}
      {showConvertModal && selected && (
        <ConvertModal
          request={selected}
          businessId={businessId!}
          onClose={() => setShowConvertModal(false)}
          onSuccess={() => {
            setShowConvertModal(false)
            closePanel()
            fetchItems()
          }}
        />
      )}
    </div>
  )
}

// ── Randevuya Çevir Modalı ──
interface ConvertModalProps {
  request: ConsultationRequest
  businessId: string
  onClose: () => void
  onSuccess: () => void
}

function ConvertModal({ request, businessId, onClose, onSuccess }: ConvertModalProps) {
  const [services, setServices] = useState<{ id: string; name: string; duration_minutes: number }[]>([])
  const [staff, setStaff] = useState<{ id: string; name: string }[]>([])
  const [serviceId, setServiceId] = useState(request.service_id || '')
  const [staffId, setStaffId] = useState('')
  const [date, setDate] = useState('')
  const [startTime, setStartTime] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function load() {
      const [svcRes, staffRes] = await Promise.all([
        fetch(`/api/public/business/${businessId}/services`),
        fetch(`/api/public/business/${businessId}/staff`),
      ])
      if (svcRes.ok) { const d = await svcRes.json(); setServices(d.services || d.data || []) }
      if (staffRes.ok) { const d = await staffRes.json(); setStaff(d.staff || d.data || []) }
    }
    load()
  }, [businessId])

  async function handleSubmit() {
    if (!serviceId || !date || !startTime) { setError('Hizmet, tarih ve saat zorunludur.'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch(`/api/consultations/${request.id}/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, staffId: staffId || null, date, startTime, notes }),
      })
      const d = await res.json()
      if (!res.ok) { setError(d.error || 'Hata oluştu.'); return }
      onSuccess()
    } finally { setSaving(false) }
  }

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 z-[70] modal-overlay" onClick={onClose} />
      <div className="fixed inset-0 z-[71] flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl w-full max-w-md modal-content">
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-800">
            <h3 className="font-bold text-gray-900 dark:text-white">Randevuya Çevir</h3>
            <button onClick={onClose} className="h-7 w-7 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800"><X className="h-4 w-4 text-gray-500" /></button>
          </div>
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">{request.full_name}</span> için randevu oluşturuluyor.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Hizmet *</label>
              <CustomSelect
                value={serviceId}
                onChange={setServiceId}
                options={[
                  { value: '', label: 'Seçiniz...' },
                  ...services.map(s => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Personel</label>
              <CustomSelect
                value={staffId}
                onChange={setStaffId}
                options={[
                  { value: '', label: 'Atanmamış' },
                  ...staff.map(s => ({ value: s.id, label: s.name })),
                ]}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tarih *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Saat *</label>
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Notlar</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Ön konsültasyona göre notlar..."
                className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 resize-none" />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}
          </div>

          <div className="flex gap-3 p-5 pt-0">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-all">İptal</button>
            <button onClick={handleSubmit} disabled={saving || !serviceId || !date || !startTime}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-semibold transition-all disabled:opacity-50">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Oluşturuluyor...</> : 'Randevu Oluştur'}
            </button>
          </div>
        </div>
      </div>
    </Portal>
  )
}
