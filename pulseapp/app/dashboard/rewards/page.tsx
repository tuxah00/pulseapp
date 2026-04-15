'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { toast } from 'sonner'
import {
  Plus, UserCheck, Search, Loader2, Gift, Phone, ArrowRight, CheckCircle, Clock, ShieldX, Trash2, Award, X
} from 'lucide-react'
import type { Referral, Customer, ReferralStatus, RewardType } from '@/types'
import { REFERRAL_STATUS_LABELS, REWARD_TYPE_LABELS } from '@/types'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { cn } from '@/lib/utils'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { Portal } from '@/components/ui/portal'

const STATUS_CONFIG: Record<ReferralStatus, { bg: string; text: string; icon: typeof CheckCircle }> = {
  pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/20', text: 'text-yellow-600 dark:text-yellow-400', icon: Clock },
  converted: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-600 dark:text-blue-400', icon: ArrowRight },
  expired: { bg: 'bg-gray-50 dark:bg-gray-800', text: 'text-gray-500 dark:text-gray-400', icon: X },
  rewarded: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-600 dark:text-green-400', icon: CheckCircle },
}

const REWARD_TYPE_OPTIONS = [
  { value: 'discount_percent', label: '% İndirim' },
  { value: 'discount_amount', label: '₺ İndirim' },
  { value: 'free_service', label: 'Ücretsiz Hizmet' },
  { value: 'points', label: 'Puan' },
  { value: 'gift', label: 'Hediye' },
]

const REWARD_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  used: 'Kullanıldı',
  expired: 'Süresi Doldu',
}

interface RewardTemplate {
  id: string
  business_id: string
  name: string
  type: string
  value: number | null
  description: string | null
  valid_days: number
  is_active: boolean
  created_at: string
}

interface CustomerReward {
  id: string
  business_id: string
  customer_id: string
  reward_id: string
  status: string
  given_at: string
  used_at: string | null
  expires_at: string | null
  notes: string | null
  rewards?: { name: string; type: string; value: number | null; description: string | null } | null
  customers?: { name: string; phone: string | null } | null
}

type TabType = 'referrals' | 'rewards'

export default function RewardsPage() {
  const { businessId, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)

  const [activeTab, setActiveTab] = useState<TabType>('rewards')

  // ── Referrals State ──
  const [referrals, setReferrals] = useState<Referral[]>([])
  const [refLoading, setRefLoading] = useState(true)
  const [refSearch, setRefSearch] = useState('')
  const [refStatusFilter, setRefStatusFilter] = useState<string>('all')
  const [showRefCreate, setShowRefCreate] = useState(false)
  const [closingRefCreate, setClosingRefCreate] = useState(false)
  const [refSaving, setRefSaving] = useState(false)
  const [formReferrerId, setFormReferrerId] = useState('')
  const [formReferredName, setFormReferredName] = useState('')
  const [formReferredPhone, setFormReferredPhone] = useState('')
  const [formRewardType, setFormRewardType] = useState<RewardType | ''>('')
  const [formRewardValue, setFormRewardValue] = useState('')

  // ── Rewards State ──
  const [rewardTemplates, setRewardTemplates] = useState<RewardTemplate[]>([])
  const [customerRewards, setCustomerRewards] = useState<CustomerReward[]>([])
  const [rwLoading, setRwLoading] = useState(true)
  const [rwStatusFilter, setRwStatusFilter] = useState<string>('all')
  const [showTemplateCreate, setShowTemplateCreate] = useState(false)
  const [closingTemplateCreate, setClosingTemplateCreate] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [closingAssign, setClosingAssign] = useState(false)
  const [rwSaving, setRwSaving] = useState(false)
  // Template form
  const [tName, setTName] = useState('')
  const [tType, setTType] = useState('')
  const [tValue, setTValue] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [tValidDays, setTValidDays] = useState('30')
  // Assign form
  const [aCustomerId, setACustomerId] = useState('')
  const [aRewardId, setARewardId] = useState('')
  const [aNotes, setANotes] = useState('')

  // ── Referrals Logic ──
  const fetchReferrals = useCallback(async () => {
    if (!businessId) return
    setRefLoading(true)
    try {
      const params = new URLSearchParams({ businessId })
      if (refStatusFilter !== 'all') params.set('status', refStatusFilter)
      const res = await fetch(`/api/referrals?${params}`)
      const json = await res.json()
      setReferrals(json.referrals || [])
    } catch { /* ignore */ } finally { setRefLoading(false) }
  }, [businessId, refStatusFilter])

  useEffect(() => { if (activeTab === 'referrals') fetchReferrals() }, [fetchReferrals, activeTab])

  const totalReferrals = referrals.length
  const rewardedCount = referrals.filter(r => r.status === 'rewarded').length
  const pendingRefCount = referrals.filter(r => r.status === 'pending').length
  const rewardRate = totalReferrals > 0 ? Math.round((rewardedCount / totalReferrals) * 100) : 0

  const handleRefCreate = async () => {
    if (!businessId || !formReferrerId) return
    setRefSaving(true)
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
        toast.success('Referans oluşturuldu')
        setShowRefCreate(false)
        resetRefForm()
        fetchReferrals()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Referans oluşturulamadı')
      }
    } catch { toast.error('Bağlantı hatası') } finally { setRefSaving(false) }
  }

  const resetRefForm = () => {
    setFormReferrerId(''); setFormReferredName(''); setFormReferredPhone('')
    setFormRewardType(''); setFormRewardValue('')
  }

  const handleReward = async (id: string) => {
    if (!businessId) return
    await fetch('/api/referrals', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessId, id, status: 'rewarded' }),
    })
    toast.success('Ödül verildi')
    fetchReferrals()
  }

  const filteredRefs = referrals.filter(r => {
    if (!refSearch) return true
    const q = refSearch.toLowerCase()
    const referrer = (Array.isArray(r.referrer) ? r.referrer[0] : r.referrer) as Customer | undefined
    const referred = (Array.isArray(r.referred) ? r.referred[0] : r.referred) as Customer | undefined
    return (
      referrer?.name?.toLowerCase().includes(q) ||
      referred?.name?.toLowerCase().includes(q) ||
      r.referred_name?.toLowerCase().includes(q) ||
      r.referred_phone?.includes(q)
    )
  })

  // ── Rewards Logic ──
  const fetchRewardTemplates = useCallback(async () => {
    if (!businessId) return
    try {
      const res = await fetch('/api/rewards?type=templates')
      const json = await res.json()
      setRewardTemplates(json.rewards || [])
    } catch { /* ignore */ }
  }, [businessId])

  const fetchCustomerRewards = useCallback(async () => {
    if (!businessId) return
    setRwLoading(true)
    try {
      const params = new URLSearchParams({ type: 'assigned' })
      if (rwStatusFilter !== 'all') params.set('status', rwStatusFilter)
      const res = await fetch(`/api/rewards?${params}`)
      const json = await res.json()
      setCustomerRewards(json.rewards || [])
    } catch { /* ignore */ } finally { setRwLoading(false) }
  }, [businessId, rwStatusFilter])

  useEffect(() => {
    if (activeTab === 'rewards') { fetchRewardTemplates(); fetchCustomerRewards() }
  }, [activeTab, fetchRewardTemplates, fetchCustomerRewards])

  const handleCreateTemplate = async () => {
    if (!tName || !tType) return
    setRwSaving(true)
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: tName, type: tType, value: tValue ? Number(tValue) : null, description: tDesc || null, validDays: Number(tValidDays) || 30 }),
      })
      if (res.ok) {
        toast.success('Ödül şablonu oluşturuldu')
        setShowTemplateCreate(false)
        setTName(''); setTType(''); setTValue(''); setTDesc(''); setTValidDays('30')
        fetchRewardTemplates()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Ödül oluşturulamadı')
      }
    } catch { toast.error('Bağlantı hatası') } finally { setRwSaving(false) }
  }

  const handleAssignReward = async () => {
    if (!aCustomerId || !aRewardId) return
    setRwSaving(true)
    try {
      const res = await fetch('/api/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign', customerId: aCustomerId, rewardId: aRewardId, notes: aNotes || null }),
      })
      if (res.ok) {
        toast.success('Ödül atandı')
        setShowAssign(false)
        setACustomerId(''); setARewardId(''); setANotes('')
        fetchCustomerRewards()
      } else {
        const json = await res.json()
        toast.error(json.error || 'Ödül atanamadı')
      }
    } catch { toast.error('Bağlantı hatası') } finally { setRwSaving(false) }
  }

  const handleMarkUsed = async (id: string) => {
    await fetch('/api/rewards', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, table: 'customer_rewards', status: 'used' }),
    })
    toast.success('Ödül kullanıldı olarak işaretlendi')
    fetchCustomerRewards()
  }

  const handleDeleteTemplate = async (id: string) => {
    const res = await fetch(`/api/rewards?id=${id}`, { method: 'DELETE' })
    if (res.ok) {
      toast.success('Ödül şablonu silindi')
      fetchRewardTemplates()
    } else {
      toast.error('Silinemedi')
    }
  }

  // ── Permission Check ──
  if (permissions && !permissions.rewards) {
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Ödüller</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Referanslar ve ödül yönetimi</p>
        </div>
        <div className="flex gap-2">
          {activeTab === 'referrals' && (
            <button onClick={() => setShowRefCreate(true)} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Yeni Referans
            </button>
          )}
          {activeTab === 'rewards' && (
            <>
              <button onClick={() => setShowTemplateCreate(true)} className="btn-secondary flex items-center gap-2">
                <Plus className="h-4 w-4" /> Ödül Tanımla
              </button>
              <button onClick={() => setShowAssign(true)} className="btn-primary flex items-center gap-2">
                <Gift className="h-4 w-4" /> Ödül Ver
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 w-fit">
        {([
          { key: 'rewards' as TabType, label: 'Ödüller', icon: Gift },
          { key: 'referrals' as TabType, label: 'Referanslar', icon: UserCheck },
        ]).map(tab => {
          const TabIcon = tab.icon
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn('flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
              )}>
              <TabIcon className="h-4 w-4" /> {tab.label}
            </button>
          )
        })}
      </div>

      {/* ═══ Referanslar Tab ═══ */}
      {activeTab === 'referrals' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="card p-4"><p className="text-xs text-gray-500 dark:text-gray-400">Toplam</p><p className="text-2xl font-bold text-gray-900 dark:text-white">{totalReferrals}</p></div>
            <div className="card p-4"><p className="text-xs text-gray-500 dark:text-gray-400">Bekleyen</p><p className="text-2xl font-bold text-yellow-600">{pendingRefCount}</p></div>
            <div className="card p-4"><p className="text-xs text-gray-500 dark:text-gray-400">Ödül Verildi</p><p className="text-2xl font-bold text-green-600">{rewardedCount}</p></div>
            <div className="card p-4"><p className="text-xs text-gray-500 dark:text-gray-400">Ödül Oranı</p><p className="text-2xl font-bold text-pulse-900">%{rewardRate}</p></div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" placeholder="Ara..." className="input pl-10 w-full" value={refSearch} onChange={e => setRefSearch(e.target.value)} />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['all', 'pending', 'rewarded'] as const).map(s => (
                <button key={s} onClick={() => setRefStatusFilter(s)}
                  className={`badge px-3 py-1.5 cursor-pointer transition-colors ${refStatusFilter === s ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                  {s === 'all' ? 'Tümü' : REFERRAL_STATUS_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          {refLoading ? (
            <div className="flex items-center justify-center h-32"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
          ) : filteredRefs.length === 0 ? (
            <div className="card p-8 text-center">
              <UserCheck className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 dark:text-gray-400">Henüz referans yok</p>
            </div>
          ) : (
            <AnimatedList className="space-y-3">
              {filteredRefs.map(r => {
                const referrer = (Array.isArray(r.referrer) ? r.referrer[0] : r.referrer) as Customer | undefined
                const referred = (Array.isArray(r.referred) ? r.referred[0] : r.referred) as Customer | undefined
                const sc = STATUS_CONFIG[r.status]
                const Icon = sc.icon
                return (
                  <AnimatedItem key={r.id} className="card p-4">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-4 min-w-0">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">Tavsiye Eden</p>
                          <p className="font-medium text-gray-900 dark:text-white truncate">{referrer?.name || '—'}</p>
                          {referrer?.phone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {referrer.phone}</p>}
                        </div>
                        <ArrowRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">Tavsiye Edilen</p>
                          <p className="font-medium text-gray-900 dark:text-white truncate">{referred?.name || r.referred_name || '—'}</p>
                          {(referred?.phone || r.referred_phone) && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone className="h-3 w-3" /> {referred?.phone || r.referred_phone}</p>}
                        </div>
                      </div>
                      <div className="w-[180px] flex-shrink-0 text-right">
                        {r.reward_type ? (
                          <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1 justify-end mb-0.5">
                            <Gift className="h-3 w-3" />
                            {r.reward_value}{r.reward_type === 'discount_percent' ? '%' : r.reward_type === 'discount_amount' ? '₺' : ''} {REWARD_TYPE_LABELS[r.reward_type]}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-300 dark:text-gray-600 mb-0.5">—</p>
                        )}
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${sc.bg} ${sc.text}`}>
                          <Icon className="h-3 w-3" /> {REFERRAL_STATUS_LABELS[r.status]}
                        </span>
                        {r.status === 'rewarded' && <p className="text-[10px] text-green-500 mt-0.5">Ödül verildi</p>}
                      </div>
                      <div className="w-[80px] flex-shrink-0 flex gap-1 justify-end">
                        {r.status === 'pending' && (
                          <button onClick={() => handleReward(r.id)} className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors">Ödül Ver</button>
                        )}
                      </div>
                    </div>
                  </AnimatedItem>
                )
              })}
            </AnimatedList>
          )}
        </>
      )}

      {/* ═══ Ödüller Tab ═══ */}
      {activeTab === 'rewards' && (
        <>
          {/* Reward Templates */}
          <div>
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Ödül Şablonları</h2>
            {rewardTemplates.length === 0 ? (
              <div className="card p-6 text-center">
                <Award className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Henüz ödül şablonu tanımlanmamış</p>
                <p className="text-xs text-gray-400 mt-1">&ldquo;Ödül Tanımla&rdquo; butonuyla başlayın</p>
              </div>
            ) : (
              <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {rewardTemplates.map(t => (
                  <AnimatedItem key={t.id} className="card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{t.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {REWARD_TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type}
                          {t.value ? ` — ${t.value}${t.type === 'discount_percent' ? '%' : t.type === 'discount_amount' ? '₺' : ''}` : ''}
                        </p>
                        {t.description && <p className="text-xs text-gray-400 mt-1">{t.description}</p>}
                        <p className="text-[10px] text-gray-400 mt-1">Geçerlilik: {t.valid_days} gün</p>
                      </div>
                      <button onClick={() => handleDeleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" title="Sil">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </AnimatedItem>
                ))}
              </AnimatedList>
            )}
          </div>

          {/* Assigned Rewards */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Atanmış Ödüller</h2>
              <div className="flex gap-2">
                {(['all', 'pending', 'used', 'expired'] as const).map(s => (
                  <button key={s} onClick={() => setRwStatusFilter(s)}
                    className={`badge px-2.5 py-1 cursor-pointer text-xs transition-colors ${rwStatusFilter === s ? 'bg-gray-900 dark:bg-gray-700 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'}`}>
                    {s === 'all' ? 'Tümü' : REWARD_STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            {rwLoading ? (
              <div className="flex items-center justify-center h-24"><Loader2 className="h-5 w-5 animate-spin text-pulse-900" /></div>
            ) : customerRewards.length === 0 ? (
              <div className="card p-6 text-center">
                <Gift className="h-10 w-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-500 dark:text-gray-400">Henüz atanmış ödül yok</p>
              </div>
            ) : (
              <AnimatedList className="space-y-2">
                {customerRewards.map(cr => (
                  <AnimatedItem key={cr.id} className="card p-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{cr.customers?.name || '—'}</p>
                        <p className="text-xs text-gray-500">{cr.rewards?.name || '—'} — {REWARD_TYPE_OPTIONS.find(o => o.value === cr.rewards?.type)?.label || ''}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          cr.status === 'pending' ? 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : cr.status === 'used' ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        }`}>
                          {REWARD_STATUS_LABELS[cr.status] || cr.status}
                        </span>
                        {cr.expires_at && <p className="text-[10px] text-gray-400 mt-0.5">Son: {new Date(cr.expires_at).toLocaleDateString('tr-TR')}</p>}
                      </div>
                      {cr.status === 'pending' && (
                        <button onClick={() => handleMarkUsed(cr.id)} className="text-xs px-2 py-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 hover:bg-green-200 transition-colors flex-shrink-0">
                          Kullanıldı
                        </button>
                      )}
                    </div>
                    {cr.notes && <p className="text-xs text-gray-400 mt-1 pl-1 border-l-2 border-gray-200 dark:border-gray-700">{cr.notes}</p>}
                  </AnimatedItem>
                ))}
              </AnimatedList>
            )}
          </div>
        </>
      )}

      {/* ═══ Modals ═══ */}

      {/* Referans Oluştur */}
      {(showRefCreate || closingRefCreate) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingRefCreate ? 'closing' : ''}`} onClick={() => { setClosingRefCreate(true) }} onAnimationEnd={() => { if (closingRefCreate) { setShowRefCreate(false); setClosingRefCreate(false); resetRefForm() } }}>
          <div className={`modal-content card w-full max-w-lg dark:bg-gray-900 ${closingRefCreate ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">Yeni Referans</h3>
              <button onClick={() => setClosingRefCreate(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label">{`Tavsiye Eden ${customerLabel} *`}</label>
                <CustomerSearchSelect value={formReferrerId} onChange={v => setFormReferrerId(v)} businessId={businessId!} placeholder={`${customerLabel} seçin...`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Tavsiye Edilen Ad</label><input className="input w-full" placeholder="Ad Soyad" value={formReferredName} onChange={e => setFormReferredName(e.target.value)} /></div>
                <div><label className="label">Telefon</label><input className="input w-full" placeholder="05XX XXX XXXX" value={formReferredPhone} onChange={e => setFormReferredPhone(e.target.value)} /></div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Ödül Tipi</label>
                  <CustomSelect options={(Object.entries(REWARD_TYPE_LABELS) as [RewardType, string][]).map(([k, v]) => ({ value: k, label: v }))} value={formRewardType} onChange={v => setFormRewardType(v as RewardType)} placeholder="Seçin (opsiyonel)" />
                </div>
                <div><label className="label">Ödül Değeri</label><input type="number" className="input w-full" placeholder="Miktar" value={formRewardValue} onChange={e => setFormRewardValue(e.target.value)} /></div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setClosingRefCreate(true)} className="btn-secondary">İptal</button>
              <button onClick={handleRefCreate} disabled={refSaving || !formReferrerId} className="btn-primary disabled:opacity-50">
                {refSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Plus className="h-4 w-4 mr-1 inline" />} Oluştur
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Ödül Şablonu Oluştur */}
      {(showTemplateCreate || closingTemplateCreate) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingTemplateCreate ? 'closing' : ''}`} onClick={() => setClosingTemplateCreate(true)} onAnimationEnd={() => { if (closingTemplateCreate) { setShowTemplateCreate(false); setClosingTemplateCreate(false) } }}>
          <div className={`modal-content card w-full max-w-md dark:bg-gray-900 ${closingTemplateCreate ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">Yeni Ödül Şablonu</h3>
              <button onClick={() => setClosingTemplateCreate(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label label-required">Ödül Adı</label><input className="input w-full" placeholder="ör. %10 İndirim Kuponu" value={tName} onChange={e => setTName(e.target.value)} /></div>
              <div><label className="label label-required">Tip</label><CustomSelect options={REWARD_TYPE_OPTIONS} value={tType} onChange={v => setTType(v)} placeholder="Tip seçin" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="label">Değer</label><input type="number" className="input w-full" placeholder="Miktar" value={tValue} onChange={e => setTValue(e.target.value)} /></div>
                <div><label className="label">Geçerlilik (gün)</label><input type="number" className="input w-full" value={tValidDays} onChange={e => setTValidDays(e.target.value)} /></div>
              </div>
              <div><label className="label">Açıklama</label><textarea className="input w-full" rows={2} placeholder="Opsiyonel açıklama..." value={tDesc} onChange={e => setTDesc(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setClosingTemplateCreate(true)} className="btn-secondary">İptal</button>
              <button onClick={handleCreateTemplate} disabled={rwSaving || !tName || !tType} className="btn-primary disabled:opacity-50">
                {rwSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Plus className="h-4 w-4 mr-1 inline" />} Oluştur
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}

      {/* Ödül Ata */}
      {(showAssign || closingAssign) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 ${closingAssign ? 'closing' : ''}`} onClick={() => { setClosingAssign(true) }} onAnimationEnd={() => { if (closingAssign) { setShowAssign(false); setClosingAssign(false); setACustomerId(''); setARewardId(''); setANotes('') } }}>
          <div className={`modal-content card w-full max-w-md dark:bg-gray-900 ${closingAssign ? 'closing' : ''}`} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-medium">{customerLabel} Ödül Ver</h3>
              <button onClick={() => setClosingAssign(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="label label-required">{customerLabel}</label>
                <CustomerSearchSelect value={aCustomerId} onChange={v => setACustomerId(v)} businessId={businessId!} placeholder={`${customerLabel} seçin...`} />
              </div>
              <div>
                <label className="label label-required">Ödül</label>
                <CustomSelect
                  options={rewardTemplates.filter(t => t.is_active).map(t => ({ value: t.id, label: `${t.name} (${REWARD_TYPE_OPTIONS.find(o => o.value === t.type)?.label || t.type})` }))}
                  value={aRewardId} onChange={v => setARewardId(v)} placeholder="Ödül seçin"
                />
              </div>
              <div><label className="label">Not</label><textarea className="input w-full" rows={2} placeholder="Opsiyonel not..." value={aNotes} onChange={e => setANotes(e.target.value)} /></div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setClosingAssign(true)} className="btn-secondary">İptal</button>
              <button onClick={handleAssignReward} disabled={rwSaving || !aCustomerId || !aRewardId} className="btn-primary disabled:opacity-50">
                {rwSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1 inline" /> : <Gift className="h-4 w-4 mr-1 inline" />} Ödül Ver
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
