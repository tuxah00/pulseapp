'use client'

import { useState, useEffect, useCallback } from 'react'
import { Portal } from '@/components/ui/portal'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { getAppointmentNotesPlaceholder, getMembershipPlanPlaceholder } from '@/lib/config/sector-labels'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission, requireSectorModule } from '@/lib/hooks/use-require-permission'
import {
  CreditCard, Users, Calendar, Plus, Search, X,
  Edit2, Trash2, Pause, Play, CheckCircle, Loader2,
  LayoutList, LayoutGrid, Filter, ArrowUpDown,
} from 'lucide-react'
import { cn, formatDateISO } from '@/lib/utils'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import CompactBoxCard from '@/components/ui/compact-box-card'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { Pagination } from '@/components/ui/pagination'

interface Membership {
  id: string
  business_id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  plan_name: string
  start_date: string
  end_date: string | null
  price: number | null
  status: 'active' | 'expired' | 'frozen' | 'cancelled'
  sessions_total: number | null
  sessions_used: number
  notes: string | null
  created_at: string
  updated_at: string
}

type StatusFilter = 'all' | 'active' | 'expired' | 'frozen' | 'cancelled'

const STATUS_LABELS: Record<string, string> = {
  active: 'Aktif',
  expired: 'Süresi Dolmuş',
  frozen: 'Dondurulmuş',
  cancelled: 'İptal',
}

const STATUS_COLORS: Record<string, string> = {
  active: 'badge-success',
  expired: 'badge-danger',
  frozen: 'badge-info',
  cancelled: 'badge-neutral',
}

const FILTER_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'Tümü' },
  { key: 'active', label: 'Aktif' },
  { key: 'expired', label: 'Süresi Dolmuş' },
  { key: 'frozen', label: 'Dondurulmuş' },
  { key: 'cancelled', label: 'İptal' },
]

function isExpiredButActive(m: Membership): boolean {
  if (m.status !== 'active') return false
  if (!m.end_date) return false
  return new Date(m.end_date) < new Date(new Date().toDateString())
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function MembershipsPage() {
  const { businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showModal, setShowModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('memberships', 'list')
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 50
  const { confirm } = useConfirm()

  // Form state
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [planName, setPlanName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [price, setPrice] = useState('')
  const [sessionsTotal, setSessionsTotal] = useState('')
  const [notes, setNotes] = useState('')

  const fetchMemberships = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())
      params.set('page', String(page))
      params.set('pageSize', String(PAGE_SIZE))

      const res = await fetch(`/api/memberships?${params}`)
      const json = await res.json()
      if (!res.ok) {
        if (json.error?.includes('does not exist')) {
          setDbError('Üyelikler tablosu henüz oluşturulmamış. Lütfen Supabase\'de 011_create_memberships.sql migrasyonunu çalıştırın.')
        } else {
          setDbError(json.error || 'Bilinmeyen hata')
        }
      } else {
        setMemberships(json.memberships || [])
        setTotalCount(json.total || 0)
        setDbError(null)
      }
    } catch {
      setDbError('Sunucuya bağlanılamadı.')
    }
    setLoading(false)
  }, [businessId, statusFilter, debouncedSearch, page])

  useEffect(() => {
    if (!ctxLoading) fetchMemberships()
  }, [fetchMemberships, ctxLoading])

  useEffect(() => { setPage(0) }, [statusFilter, debouncedSearch])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  function openNewModal() {
    setEditingMembership(null)
    setCustomerName('')
    setCustomerPhone('')
    setPlanName('')
    setStartDate(formatDateISO(new Date()))
    setEndDate('')
    setPrice('')
    setSessionsTotal('')
    setNotes('')
    setError(null)
    setShowModal(true)
  }

  function openEditModal(m: Membership) {
    setEditingMembership(m)
    setCustomerName(m.customer_name)
    setCustomerPhone(m.customer_phone || '')
    setPlanName(m.plan_name)
    setStartDate(m.start_date)
    setEndDate(m.end_date || '')
    setPrice(m.price != null ? String(m.price) : '')
    setSessionsTotal(m.sessions_total != null ? String(m.sessions_total) : '')
    setNotes(m.notes || '')
    setError(null)
    setShowModal(true)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)

    const payload: Record<string, unknown> = {
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim() || null,
      plan_name: planName.trim(),
      start_date: startDate,
      end_date: endDate || null,
      price: price ? parseFloat(price) : null,
      sessions_total: sessionsTotal ? parseInt(sessionsTotal) : null,
      notes: notes.trim() || null,
    }

    try {
      let res: Response
      if (editingMembership) {
        res = await fetch(`/api/memberships?id=${editingMembership.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      } else {
        payload.business_id = businessId
        payload.status = 'active'
        payload.sessions_used = 0
        res = await fetch('/api/memberships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
      }

      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Kayıt hatası')
        setSaving(false)
        return
      }

      closeModal()
      fetchMemberships()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: editingMembership ? 'Üyelik güncellendi' : 'Üyelik eklendi' } }))
    } catch {
      setError('Sunucu hatası')
    }
    setSaving(false)
  }

  async function handleDelete(m: Membership) {
    const ok = await confirm({ title: 'Onay', message: `"${m.customer_name}" üyeliğini silmek istediğinize emin misiniz?` })
    if (!ok) return
    const res = await fetch(`/api/memberships?id=${m.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Silme hatası: ' + json.error } }))
      return
    }
    fetchMemberships()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Üyelik silindi' } }))
  }

  async function handleAddSession(m: Membership) {
    const newUsed = m.sessions_used + 1
    if (m.sessions_total != null && newUsed > m.sessions_total) {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Toplam seans sayısını aşamazsınız.' } }))
      return
    }
    const res = await fetch(`/api/memberships?id=${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions_used: newUsed }),
    })
    if (!res.ok) {
      const json = await res.json()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Seans güncelleme hatası: ' + json.error } }))
      return
    }
    setMemberships(prev =>
      prev.map(item => item.id === m.id ? { ...item, sessions_used: newUsed } : item)
    )
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Seans güncellendi' } }))
  }

  async function handleToggleFreeze(m: Membership) {
    const newStatus = m.status === 'frozen' ? 'active' : 'frozen'
    const res = await fetch(`/api/memberships?id=${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    if (!res.ok) {
      const json = await res.json()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Hata', body: 'Durum güncelleme hatası: ' + json.error } }))
      return
    }
    setMemberships(prev =>
      prev.map(item => item.id === m.id ? { ...item, status: newStatus } : item)
    )
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: newStatus === 'frozen' ? 'Üyelik donduruldu' : 'Üyelik aktifleştirildi' } }))
  }

  // Stats
  const activeCount = memberships.filter(m => m.status === 'active').length
  const expiringThisMonth = memberships.filter(m => {
    if (!m.end_date) return false
    const end = new Date(m.end_date)
    const now = new Date()
    return end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth()
  }).length
  const hasActiveFilters = statusFilter !== 'all'

  const SORT_OPTIONS = [
    { value: 'customer_name', label: `${getCustomerLabelSingular(sector ?? undefined)} adı` },
    { value: 'plan_name', label: 'Plan adı' },
    { value: 'end_date', label: 'Bitiş tarihi' },
  ]

  const sortedMemberships = sortField
    ? [...memberships].sort((a, b) => {
        const va = (a as any)[sortField]
        const vb = (b as any)[sortField]
        if (va == null && vb == null) return 0
        if (va == null) return 1; if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : memberships

  requireSectorModule(sector, 'memberships')
  requirePermission(permissions, 'memberships')

  if (loading && !memberships.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-900" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Üyelikler</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Üyelik planları, seans takibi ve süreli üyelikler
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 shrink-0">
            <ToolbarPopover icon={<Filter className="h-4 w-4" />} label="Filtre" active={hasActiveFilters}>
              <div className="p-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Durum</p>
                {FILTER_TABS.map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setStatusFilter(tab.key)}
                    className={cn(
                      'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                      statusFilter === tab.key
                        ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/40 dark:text-pulse-300 font-medium'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
                {hasActiveFilters && (
                  <button onClick={() => setStatusFilter('all')} className="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 pt-1">
                    Temizle
                  </button>
                )}
              </div>
            </ToolbarPopover>
            <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
              <SortPopoverContent options={SORT_OPTIONS} sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir} />
            </ToolbarPopover>
            <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
            <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutu"><LayoutGrid className="h-4 w-4" /></button>
          </div>
          <button onClick={openNewModal} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />Üyelik Ekle
          </button>
        </div>
      </div>

      {/* DB Error */}
      {dbError && (
        <div className="card border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 mb-6 p-4">
          <p className="font-medium text-amber-800 dark:text-amber-300">{dbError}</p>
        </div>
      )}

      {/* Stats */}
      {!dbError && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{activeCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aktif Üye</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{expiringThisMonth}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bu Ay Bitiyor</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{totalCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      {!dbError && (
        <div className="mb-6 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-10"
            placeholder={`${getCustomerLabelSingular(sector ?? undefined)} adına göre ara...`}
          />
        </div>
      )}

      {/* List / Grid */}
      {!dbError && memberships.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <CreditCard className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-600" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {search ? 'Aramanızla eşleşen üyelik bulunamadı' : 'Henüz üyelik eklenmemiş'}
          </h3>
          {!search && (
            <p className="mt-1 mb-4 text-sm text-gray-400">
              Sağ üstteki butonu kullanarak ilk üyeliği ekleyin.
            </p>
          )}
          {!search && (
            <button onClick={openNewModal} className="btn-primary">
              <Plus className="mr-2 h-4 w-4" />İlk Üyeliği Ekle
            </button>
          )}
        </div>
      ) : !dbError ? (
        <div key={viewMode} className="view-transition">
          {viewMode === 'list' && (
            <AnimatedList className="space-y-3">
              {sortedMemberships.map(m => (
                <AnimatedItem key={m.id} onClick={() => openEditModal(m)} className="card flex items-center gap-4 p-4 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{m.customer_name}</span>
                      <span className={STATUS_COLORS[m.status]}>{STATUS_LABELS[m.status]}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{m.plan_name}</p>
                    {m.end_date && <p className="text-xs text-gray-400">Bitiş: {formatDate(m.end_date)}</p>}
                  </div>
                  {m.sessions_total != null && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {m.sessions_used}/{m.sessions_total} seans
                    </div>
                  )}
                </AnimatedItem>
              ))}
            </AnimatedList>
          )}
          {viewMode === 'box' && (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
          {sortedMemberships.map(m => (
            <CompactBoxCard
              key={m.id}
              initials={m.customer_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              title={m.customer_name}
              onClick={() => openEditModal(m)}
            />
          ))}
        </div>
          )}
        </div>
      ) : null}

      {!dbError && <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />}

      {/* Modal */}
      {showModal && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/50 dark:bg-black/70 p-4 ${isClosingModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingModal) { setShowModal(false); setIsClosingModal(false) } }}>
          <div className={`modal-content card w-full max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-900 ${isClosingModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingMembership ? 'Üyeliği Düzenle' : 'Yeni Üyelik Ekle'}
              </h2>
              <button onClick={() => closeModal()} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">{`${getCustomerLabelSingular(sector ?? undefined)} Adı`}</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={e => setCustomerName(e.target.value)}
                    className="input"
                    placeholder="Ad Soyad"
                    required
                    autoFocus
                  />
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Telefon (opsiyonel)</label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={e => setCustomerPhone(e.target.value)}
                    className="input"
                    placeholder="05xx xxx xx xx"
                  />
                </div>
              </div>

              <div>
                <label className="label">Plan Adı</label>
                <input
                  type="text"
                  value={planName}
                  onChange={e => setPlanName(e.target.value)}
                  className="input"
                  placeholder={getMembershipPlanPlaceholder(sector)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="input"
                    required
                  />
                </div>
                <div>
                  <label className="label">Bitiş Tarihi (opsiyonel)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    className="input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fiyat (TL, opsiyonel)</label>
                  <input
                    type="number"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    className="input"
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="label">Toplam Seans (opsiyonel)</label>
                  <input
                    type="number"
                    value={sessionsTotal}
                    onChange={e => setSessionsTotal(e.target.value)}
                    className="input"
                    placeholder="Boşsa sınırsız"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="label">Notlar (opsiyonel)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="input"
                  rows={2}
                  placeholder={getAppointmentNotesPlaceholder(sector)}
                />
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => closeModal()}
                  className="btn-secondary flex-1"
                >
                  İptal
                </button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingMembership ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
