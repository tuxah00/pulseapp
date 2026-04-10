'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Plus, UserCheck, Search, X, Loader2, Gift, Phone, ArrowRight, CheckCircle, Clock, ShieldX
} from 'lucide-react'
import type { Referral, Customer, ReferralStatus, RewardType } from '@/types'
import { REFERRAL_STATUS_LABELS, REWARD_TYPE_LABELS } from '@/types'
import { formatCurrency } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { Portal } from '@/components/ui/portal'

const STATUS_CONFIG: Record<ReferralStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
  converted: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle },
  expired: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', icon: X },
}


export default function ReferralsPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()

  const [referrals, setReferrals] = useState<Referral[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Create modal
  const [showCreate, setShowCreate] = useState(false)
  const [isClosingCreate, setIsClosingCreate] = useState(false)
  const closeCreate = () => setIsClosingCreate(true)
  const [saving, setSaving] = useState(false)
  const [formReferrerId, setFormReferrerId] = useState('')
  const [formReferredName, setFormReferredName] = useState('')
  const [formReferredPhone, setFormReferredPhone] = useState('')
  const [formRewardType, setFormRewardType] = useState<RewardType | ''>('')
  const [formRewardValue, setFormRewardValue] = useState('')

  const fetchReferrals = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ businessId })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await fetch(`/api/referrals?${params}`)
      const json = await res.json()
      setReferrals(json.referrals || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [businessId, statusFilter])

  useEffect(() => { fetchReferrals() }, [fetchReferrals])

  useEffect(() => {
    if (!showCreate) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCreate() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showCreate])

  // Stats
  const totalReferrals = referrals.length
  const convertedCount = referrals.filter(r => r.status === 'converted').length
  const pendingCount = referrals.filter(r => r.status === 'pending').length
  const conversionRate = totalReferrals > 0 ? Math.round((convertedCount / totalReferrals) * 100) : 0

  const handleCreate = async () => {
    if (!businessId || !formReferrerId) return
    setSaving(true)
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessId,
          referrerCustomerId: formReferrerId,
          referredName: formReferredName || null,
          referredPhone: formReferredPhone || null,
          rewardType: formRewardType || null,
          rewardValue: formRewardValue ? Number(formRewardValue) : null,
        }),
      })
      if (res.ok) {
        closeCreate()
        resetForm()
        fetchReferrals()
      }
    } catch { /* ignore */ } finally { setSaving(false) }
  }

  const resetForm = () => {
    setFormReferrerId('')
    setFormReferredName('')
    setFormReferredPhone('')
    setFormRewardType('')
    setFormRewardValue('')
  }

  const handleConvert = async (referralId: string) => {
    if (!businessId) return
    await fetch('/api/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, id: referralId, status: 'converted' }),
    })
    fetchReferrals()
  }

  const handleClaimReward = async (referralId: string) => {
    if (!businessId) return
    await fetch('/api/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, id: referralId, rewardClaimed: true }),
    })
    fetchReferrals()
  }

  const filtered = referrals.filter(r => {
    if (!search) return true
    const q = search.toLowerCase()
    const referrer = (Array.isArray(r.referrer) ? r.referrer[0] : r.referrer) as Customer | undefined
    const referred = (Array.isArray(r.referred) ? r.referred[0] : r.referred) as Customer | undefined
    return (
      referrer?.name?.toLowerCase().includes(q) ||
      referred?.name?.toLowerCase().includes(q) ||
      r.referred_name?.toLowerCase().includes(q) ||
      r.referred_phone?.includes(q)
    )
  })

  if (permissions && !permissions.referrals) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center space-y-3">
          <ShieldX className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">İşletme sahibinizle iletişime geçin.</p>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Referanslar</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Müşteri tavsiye sistemi</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2">
          <Plus className="h-4 w-4" /> Yeni Referans
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalReferrals}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Bekleyen</p>
          <p className="text-2xl font-bold text-yellow-600">{pendingCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Dönüştürülen</p>
          <p className="text-2xl font-bold text-green-600">{convertedCount}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400">Dönüşüm Oranı</p>
          <p className="text-2xl font-bold text-pulse-900">%{conversionRate}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" placeholder="Ara..." className="input pl-10 w-full" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'pending', 'converted', 'expired'] as const).map(s => (
            <button key={s}
              onClick={() => setStatusFilter(s)}
              className={`badge px-3 py-1.5 cursor-pointer transition-colors ${
                statusFilter === s
                  ? 'bg-gray-900 dark:bg-gray-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}>
              {s === 'all' ? 'Tümü' : REFERRAL_STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
      ) : filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <UserCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Henüz referans yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(r => {
            const referrer = (Array.isArray(r.referrer) ? r.referrer[0] : r.referrer) as Customer | undefined
            const referred = (Array.isArray(r.referred) ? r.referred[0] : r.referred) as Customer | undefined
            const sc = STATUS_CONFIG[r.status]
            const Icon = sc.icon

            return (
              <div key={r.id} className="card p-4">
                <div className="flex items-center gap-4">
                  {/* Referrer */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-0.5">Tavsiye Eden</p>
                    <p className="font-medium text-gray-900 dark:text-white truncate">{referrer?.name || '—'}</p>
                    {referrer?.phone && (
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {referrer.phone}</p>
                    )}
                  </div>

                  <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />

                  {/* Referred */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400 mb-0.5">Tavsiye Edilen</p>
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {referred?.name || r.referred_name || '—'}
                    </p>
                    {(referred?.phone || r.referred_phone) && (
                      <p className="text-xs text-gray-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {referred?.phone || r.referred_phone}
                      </p>
                    )}
                  </div>

                  {/* Reward */}
                  <div className="flex-shrink-0 text-right">
                    {r.reward_type && (
                      <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 justify-end mb-0.5">
                        <Gift className="h-3 w-3" />
                        {r.reward_value}{r.reward_type === 'discount_percent' ? '%' : r.reward_type === 'discount_amount' ? '₺' : ''} {REWARD_TYPE_LABELS[r.reward_type]}
                      </p>
                    )}
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                      <Icon className="h-3 w-3" /> {REFERRAL_STATUS_LABELS[r.status]}
                    </span>
                    {r.reward_claimed && (
                      <p className="text-[10px] text-green-500 mt-0.5">Ödül alındı</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex-shrink-0 flex gap-1">
                    {r.status === 'pending' && (
                      <button onClick={() => handleConvert(r.id)} className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors">
                        Dönüştür
                      </button>
                    )}
                    {r.status === 'converted' && r.reward_type && !r.reward_claimed && (
                      <button onClick={() => handleClaimReward(r.id)} className="text-xs px-2 py-1 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 hover:bg-purple-200 transition-colors">
                        Ödül Ver
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {(showCreate || isClosingCreate) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 flex items-center justify-center p-4 ${isClosingCreate ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingCreate) { setShowCreate(false); setIsClosingCreate(false) } }}>
          <div className={`modal-content bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-lg ${isClosingCreate ? 'closing' : ''}`}>
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Yeni Referans</h2>
              <button onClick={() => { closeCreate(); resetForm() }} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Tavsiye Eden Müşteri *</label>
                <CustomerSearchSelect
                  value={formReferrerId}
                  onChange={v => setFormReferrerId(v)}
                  businessId={businessId!}
                  placeholder="Müşteri seçin..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Tavsiye Edilen Ad</label>
                  <input className="input w-full" placeholder="Ad Soyad" value={formReferredName} onChange={e => setFormReferredName(e.target.value)} />
                </div>
                <div>
                  <label className="label">Telefon</label>
                  <input className="input w-full" placeholder="05XX XXX XXXX" value={formReferredPhone} onChange={e => setFormReferredPhone(e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ödül Tipi</label>
                  <CustomSelect
                    options={(Object.entries(REWARD_TYPE_LABELS) as [RewardType, string][]).map(([k, v]) => ({ value: k, label: v }))}
                    value={formRewardType}
                    onChange={v => setFormRewardType(v as RewardType)}
                    placeholder="Seçin (opsiyonel)"
                  />
                </div>
                <div>
                  <label className="label">Ödül Değeri</label>
                  <input type="number" className="input w-full" placeholder="Miktar" value={formRewardValue} onChange={e => setFormRewardValue(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button onClick={() => { closeCreate(); resetForm() }} className="btn-secondary">İptal</button>
              <button onClick={handleCreate} disabled={saving || !formReferrerId} className="btn-primary disabled:opacity-50">
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
