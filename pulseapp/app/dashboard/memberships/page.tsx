'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useDebounce } from '@/lib/hooks/use-debounce'
import {
  CreditCard, Users, Calendar, Plus, Search, X,
  Edit2, Trash2, Pause, Play, CheckCircle, Loader2,
  LayoutList, LayoutGrid,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import CompactBoxCard from '@/components/ui/compact-box-card'

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
  active: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  expired: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  frozen: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',
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
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [showModal, setShowModal] = useState(false)
  const [editingMembership, setEditingMembership] = useState<Membership | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dbError, setDbError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useViewMode('memberships', 'list')

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
        setDbError(null)
      }
    } catch {
      setDbError('Sunucuya bağlanılamadı.')
    }
    setLoading(false)
  }, [businessId, statusFilter, debouncedSearch])

  useEffect(() => {
    if (!ctxLoading) fetchMemberships()
  }, [fetchMemberships, ctxLoading])

  useEffect(() => {
    if (!showModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowModal(false) }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showModal])

  function openNewModal() {
    setEditingMembership(null)
    setCustomerName('')
    setCustomerPhone('')
    setPlanName('')
    setStartDate(new Date().toISOString().split('T')[0])
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

      setShowModal(false)
      fetchMemberships()
    } catch {
      setError('Sunucu hatası')
    }
    setSaving(false)
  }

  async function handleDelete(m: Membership) {
    if (!confirm(`"${m.customer_name}" üyeliğini silmek istediğinize emin misiniz?`)) return
    const res = await fetch(`/api/memberships?id=${m.id}`, { method: 'DELETE' })
    if (!res.ok) {
      const json = await res.json()
      alert('Silme hatası: ' + json.error)
      return
    }
    fetchMemberships()
  }

  async function handleAddSession(m: Membership) {
    const newUsed = m.sessions_used + 1
    if (m.sessions_total != null && newUsed > m.sessions_total) {
      alert('Toplam seans sayısını aşamazsınız.')
      return
    }
    const res = await fetch(`/api/memberships?id=${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessions_used: newUsed }),
    })
    if (!res.ok) {
      const json = await res.json()
      alert('Seans güncelleme hatası: ' + json.error)
      return
    }
    setMemberships(prev =>
      prev.map(item => item.id === m.id ? { ...item, sessions_used: newUsed } : item)
    )
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
      alert('Durum güncelleme hatası: ' + json.error)
      return
    }
    setMemberships(prev =>
      prev.map(item => item.id === m.id ? { ...item, status: newStatus } : item)
    )
  }

  // Stats
  const activeCount = memberships.filter(m => m.status === 'active').length
  const expiringThisMonth = memberships.filter(m => {
    if (!m.end_date) return false
    const end = new Date(m.end_date)
    const now = new Date()
    return end.getFullYear() === now.getFullYear() && end.getMonth() === now.getMonth()
  }).length
  const totalCount = memberships.length

  if (permissions && !permissions.memberships) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

  if (loading && !memberships.length) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Üyelikler</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Üyelik planları, seans takibi ve süreli üyelikler
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded', viewMode === 'list' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800')} title="Liste"><LayoutList className="h-4 w-4" /></button>
            <button onClick={() => setViewMode('box')} className={cn('p-1.5 rounded', viewMode === 'box' ? 'bg-gray-200 dark:bg-gray-700' : 'hover:bg-gray-100 dark:hover:bg-gray-800')} title="Kutu"><LayoutGrid className="h-4 w-4" /></button>
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
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{activeCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Aktif Üye</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30">
              <Calendar className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{expiringThisMonth}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bu Ay Bitiyor</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30">
              <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{totalCount}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
            </div>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      {!dbError && (
        <div className="mb-4 flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700 pb-px">
          {FILTER_TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={[
                'px-4 py-2 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors',
                statusFilter === tab.key
                  ? 'border-b-2 border-pulse-500 text-pulse-600 dark:text-pulse-400'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
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
            placeholder="Müşteri adına göre ara..."
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
        <>
          {viewMode === 'list' && (
            <div className="space-y-3">
              {memberships.map(m => (
                <div key={m.id} onClick={() => openEditModal(m)} className="card flex items-center gap-4 p-4 cursor-pointer hover:shadow-md transition-all">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{m.customer_name}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[m.status]}`}>{STATUS_LABELS[m.status]}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{m.plan_name}</p>
                    {m.end_date && <p className="text-xs text-gray-400">Bitiş: {formatDate(m.end_date)}</p>}
                  </div>
                  {m.sessions_total != null && (
                    <div className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
                      {m.sessions_used}/{m.sessions_total} seans
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {viewMode === 'box' && (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
          {memberships.map(m => (
            <CompactBoxCard
              key={m.id}
              initials={m.customer_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
              title={m.customer_name}
              onClick={() => openEditModal(m)}
            />
          ))}
        </div>
          )}
        </>
      ) : null}

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="modal-content card w-full max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-900">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingMembership ? 'Üyeliği Düzenle' : 'Yeni Üyelik Ekle'}
              </h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 sm:col-span-1">
                  <label className="label">Müşteri Adı</label>
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
                  placeholder="örn. Aylık Fitness Üyeliği"
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
                  placeholder="Ek bilgi..."
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
                  onClick={() => setShowModal(false)}
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
      )}
    </div>
  )
}
