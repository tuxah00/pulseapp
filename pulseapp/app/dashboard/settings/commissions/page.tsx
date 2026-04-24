'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import {
  BadgePercent, Plus, Trash2, Loader2, Calculator, ChevronDown,
  Check, X, RefreshCw, DollarSign
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import { CustomSelect } from '@/components/ui/custom-select'
import EmptyState from '@/components/ui/empty-state'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import { addMonthsSafe } from '@/lib/utils/date-range'

interface CommissionRule {
  id: string
  staff_id: string | null
  service_id: string | null
  rate_percent: number | null
  rate_fixed: number | null
  created_at: string
  staff_members?: { id: string; name: string } | null
  services?: { id: string; name: string } | null
}

interface CommissionEarning {
  id: string
  staff_id: string
  period: string
  appointment_count: number
  total_revenue: number
  commission_total: number
  status: 'pending' | 'paid'
  paid_at: string | null
  notes: string | null
  staff_members?: { id: string; name: string } | null
}

interface StaffOption {
  id: string
  name: string
}

interface ServiceOption {
  id: string
  name: string
  price: number
}

function getCurrentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  const months = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
    'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık']
  return `${months[parseInt(month) - 1]} ${year}`
}

export default function CommissionsPage() {
  const { businessId, staffId: currentStaffId, staffName: currentStaffName, permissions } = useBusinessContext()
  const { confirm } = useConfirm()

  requirePermission(permissions, 'commissions')

  // Rules state
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [rulesLoading, setRulesLoading] = useState(true)

  // Earnings state
  const [earnings, setEarnings] = useState<CommissionEarning[]>([])
  const [earningsLoading, setEarningsLoading] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod())
  const [hasCalculated, setHasCalculated] = useState(false)

  // Staff + Services for select
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([])

  // Add rule modal
  const [showAddModal, setShowAddModal] = useState(false)
  const [isClosingModal, setIsClosingModal] = useState(false)
  const closeModal = () => setIsClosingModal(true)
  const [addStaffId, setAddStaffId] = useState<string>('')
  const [addServiceId, setAddServiceId] = useState<string>('')
  const [addRateType, setAddRateType] = useState<'percent' | 'fixed'>('percent')
  const [addRateValue, setAddRateValue] = useState('')
  const [addSaving, setAddSaving] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)

  const toast = (type: string, title: string, body?: string) => {
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type, title, body } }))
  }

  const fetchRules = useCallback(async () => {
    if (!businessId) return
    setRulesLoading(true)
    try {
      const res = await fetch('/api/commissions')
      if (!res.ok) throw new Error('Kurallar yüklenemedi')
      const data = await res.json()
      setRules(data.rules || [])
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    } finally {
      setRulesLoading(false)
    }
  }, [businessId])

  const fetchStaffAndServices = useCallback(async () => {
    if (!businessId) return
    const supabase = createClient()

    const [staffRes, servicesRes] = await Promise.all([
      supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true).order('name'),
      supabase.from('services').select('id, name, price').eq('business_id', businessId).eq('is_active', true).order('name'),
    ])

    setStaffOptions(staffRes.data || [])
    setServiceOptions(servicesRes.data || [])
  }, [businessId])

  useEffect(() => {
    fetchRules()
    fetchStaffAndServices()
  }, [fetchRules, fetchStaffAndServices])

  // Calculate earnings
  const handleCalculate = async () => {
    if (!selectedPeriod) return
    setEarningsLoading(true)
    try {
      const res = await fetch('/api/commissions/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: selectedPeriod }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Hesaplama başarısız')
      }
      const data = await res.json()
      setEarnings(data.earnings || [])
      setHasCalculated(true)
      toast('system', 'Prim Hesaplandı', `${formatPeriod(selectedPeriod)} dönemi için prim hesaplandı`)
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    } finally {
      setEarningsLoading(false)
    }
  }

  // Toggle paid status
  const handleTogglePaid = async (earning: CommissionEarning) => {
    const newStatus = earning.status === 'paid' ? 'pending' : 'paid'
    const label = newStatus === 'paid' ? 'Ödendi olarak işaretle?' : 'Ödenmedi olarak işaretle?'

    const ok = await confirm({
      title: label,
      message: newStatus === 'paid'
        ? `${(earning.staff_members as any)?.name || 'Personel'} için ${formatCurrency(earning.commission_total)} prim ödenmiş olarak kaydedilecek.`
        : `${(earning.staff_members as any)?.name || 'Personel'} için ödeme durumu geri alınacak.`,
      confirmText: newStatus === 'paid' ? 'Ödendi' : 'Geri Al',
      variant: newStatus === 'paid' ? 'warning' : 'danger',
    })
    if (!ok) return

    try {
      const res = await fetch('/api/commissions/earnings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: earning.id, status: newStatus }),
      })
      if (!res.ok) throw new Error('Güncelleme başarısız')
      setEarnings(prev => prev.map(e => e.id === earning.id ? { ...e, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null } : e))
      toast('system', newStatus === 'paid' ? 'Prim Ödendi' : 'Ödeme Geri Alındı')
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    }
  }

  // Delete rule
  const handleDeleteRule = async (rule: CommissionRule) => {
    const staffName = rule.staff_members?.name || 'Tüm Personel'
    const serviceName = rule.services?.name || 'Tüm Hizmetler'
    const ok = await confirm({
      title: 'Kural Silinsin mi?',
      message: `${staffName} — ${serviceName} kuralı kalıcı olarak silinecek.`,
      confirmText: 'Sil',
      variant: 'danger',
    })
    if (!ok) return

    try {
      const res = await fetch(`/api/commissions?id=${rule.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Silinemedi')
      setRules(prev => prev.filter(r => r.id !== rule.id))
      toast('system', 'Kural Silindi')
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    }
  }

  // Add rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddError(null)
    if (!addRateValue || Number(addRateValue) <= 0) {
      setAddError('Oran veya tutar giriniz')
      return
    }
    if (addRateType === 'percent' && Number(addRateValue) > 100) {
      setAddError('Yüzde oranı 100\'den büyük olamaz')
      return
    }

    setAddSaving(true)
    try {
      const res = await fetch('/api/commissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: addStaffId || null,
          serviceId: addServiceId || null,
          ratePercent: addRateType === 'percent' ? Number(addRateValue) : null,
          rateFixed: addRateType === 'fixed' ? Number(addRateValue) : null,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Eklenemedi')
      }
      toast('system', 'Kural Eklendi')
      closeModal()
      await fetchRules()
    } catch (e: any) {
      setAddError(e.message)
    } finally {
      setAddSaving(false)
    }
  }

  const openAddModal = () => {
    setAddStaffId('')
    setAddServiceId('')
    setAddRateType('percent')
    setAddRateValue('')
    setAddError(null)
    setShowAddModal(true)
    setIsClosingModal(false)
  }

  // Generate period options (last 12 months)
  const periodOptions = Array.from({ length: 12 }, (_, i) => {
    const d = addMonthsSafe(new Date(), -i)
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { value: val, label: formatPeriod(val) }
  })

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="h-page">Prim & Komisyon</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Personel prim kurallarını tanımlayın ve aylık kazanç özetlerini hesaplayın.
        </p>
      </div>

      {/* Prim Hesaplama Bölümü */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-5 w-5 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Prim Hesapla</h2>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px]">
            <label className="label">Dönem</label>
            <CustomSelect
              value={selectedPeriod}
              onChange={setSelectedPeriod}
              options={periodOptions}
            />
          </div>
          <button
            onClick={handleCalculate}
            disabled={earningsLoading}
            className="btn-primary"
          >
            {earningsLoading
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Calculator className="mr-2 h-4 w-4" />}
            Hesapla
          </button>
        </div>

        {/* Earnings Table */}
        {hasCalculated && (
          <div className="mt-5">
            {earnings.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                Bu dönem için tamamlanmış randevu bulunamadı.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="table-base">
                  <thead className="table-head-row">
                    <tr>
                      <th className="table-head-cell">Personel</th>
                      <th className="table-head-cell text-right">Randevu</th>
                      <th className="table-head-cell text-right">Ciro</th>
                      <th className="table-head-cell text-right">Prim</th>
                      <th className="table-head-cell text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody>
                    {earnings.map((earning) => (
                      <tr key={earning.id} className="table-row">
                        <td className="table-cell">
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {(earning.staff_members as any)?.name || '—'}
                          </span>
                        </td>
                        <td className="table-cell text-right">
                          {earning.appointment_count}
                        </td>
                        <td className="table-cell text-right">
                          {formatCurrency(earning.total_revenue)}
                        </td>
                        <td className="table-cell text-right font-semibold text-pulse-900 dark:text-pulse-300">
                          {formatCurrency(earning.commission_total)}
                        </td>
                        <td className="table-cell text-center">
                          <button
                            onClick={() => handleTogglePaid(earning)}
                            className={cn(
                              'transition-colors',
                              earning.status === 'paid'
                                ? 'badge-success hover:bg-green-200 dark:hover:bg-green-900/50'
                                : 'badge-warning hover:bg-amber-200 dark:hover:bg-amber-900/50'
                            )}
                          >
                            {earning.status === 'paid'
                              ? <><Check className="h-3 w-3" />Ödendi</>
                              : <><RefreshCw className="h-3 w-3" />Bekliyor</>
                            }
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-head-row">
                    <tr>
                      <td className="table-cell font-semibold text-gray-900 dark:text-gray-100">Toplam</td>
                      <td className="table-cell text-right font-semibold text-gray-900 dark:text-gray-100">
                        {earnings.reduce((s, e) => s + e.appointment_count, 0)}
                      </td>
                      <td className="table-cell text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatCurrency(earnings.reduce((s, e) => s + e.total_revenue, 0))}
                      </td>
                      <td className="table-cell text-right font-semibold text-pulse-900 dark:text-pulse-300">
                        {formatCurrency(earnings.reduce((s, e) => s + e.commission_total, 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Kural Listesi */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-pulse-900 dark:text-pulse-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Komisyon Kuralları</h2>
            {rules.length > 0 && (
              <span className="badge-neutral">{rules.length}</span>
            )}
          </div>
          <button onClick={openAddModal} className="btn-primary text-sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Kural Ekle
          </button>
        </div>

        {rulesLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : rules.length === 0 ? (
          <EmptyState
            icon={<BadgePercent className="h-7 w-7" />}
            title="Komisyon kuralı yok"
            description="Personel veya hizmet bazlı prim kuralları ekleyerek otomatik hesaplama yapabilirsiniz."
            action={{ label: 'Kural Ekle', onClick: openAddModal, icon: <Plus className="h-4 w-4 mr-1.5" /> }}
          />
        ) : (
          <div className="space-y-2">
            {/* Rules table header */}
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 px-3 py-2 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              <span>Personel</span>
              <span>Hizmet</span>
              <span>Oran / Tutar</span>
              <span></span>
            </div>
            {rules.map((rule) => (
              <div key={rule.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3 px-3 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors">
                <span className="text-sm text-gray-900 dark:text-gray-100">
                  {rule.staff_members?.name || <span className="text-gray-400 italic">Tüm Personel</span>}
                </span>
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  {rule.services?.name || <span className="text-gray-400 italic">Tüm Hizmetler</span>}
                </span>
                <span className={cn(
                  'font-semibold',
                  rule.rate_percent ? 'badge-brand' : 'badge-info'
                )}>
                  {rule.rate_percent ? `%${rule.rate_percent}` : formatCurrency(rule.rate_fixed || 0)}
                </span>
                <button
                  onClick={() => handleDeleteRule(rule)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}

            {/* Rule priority note */}
            <p className="text-xs text-gray-400 dark:text-gray-500 pt-2 px-1">
              Öncelik sırası: Personel+Hizmet → Sadece Personel → Sadece Hizmet → Genel Kural
            </p>
          </div>
        )}
      </div>

      {/* Kural Ekle Modal */}
      {showAddModal && (
        <Portal>
          <div
            className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${isClosingModal ? 'closing' : ''}`}
            onClick={closeModal}
            onAnimationEnd={() => {
              if (isClosingModal) { setShowAddModal(false); setIsClosingModal(false) }
            }}
          >
            <div
              className={`modal-content card w-full max-w-md ${isClosingModal ? 'closing' : ''}`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="h-section">Komisyon Kuralı Ekle</h2>
                <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddRule} className="space-y-4">
                <div>
                  <label className="label">Personel <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
                  <CustomSelect
                    value={addStaffId}
                    onChange={setAddStaffId}
                    options={[
                      { value: '', label: 'Tüm Personel' },
                      ...staffOptions.map(s => ({ value: s.id, label: s.name })),
                    ]}
                    placeholder="Tüm Personel"
                  />
                </div>

                <div>
                  <label className="label">Hizmet <span className="text-gray-400 font-normal">(opsiyonel)</span></label>
                  <CustomSelect
                    value={addServiceId}
                    onChange={setAddServiceId}
                    options={[
                      { value: '', label: 'Tüm Hizmetler' },
                      ...serviceOptions.map(s => ({ value: s.id, label: `${s.name}${s.price ? ` — ${formatCurrency(s.price)}` : ''}` })),
                    ]}
                    placeholder="Tüm Hizmetler"
                  />
                </div>

                <div>
                  <label className="label">Oran Türü</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setAddRateType('percent')}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        addRateType === 'percent'
                          ? 'bg-pulse-900 text-white border-pulse-900'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      Yüzde (%)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAddRateType('fixed')}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-sm font-medium border transition-colors',
                        addRateType === 'fixed'
                          ? 'bg-pulse-900 text-white border-pulse-900'
                          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                      )}
                    >
                      Sabit Tutar (₺)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="label">
                    {addRateType === 'percent' ? 'Yüzde Oranı (%)' : 'Sabit Tutar (₺)'}
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={addRateType === 'percent' ? '100' : undefined}
                    step="0.01"
                    value={addRateValue}
                    onChange={(e) => setAddRateValue(e.target.value)}
                    className="input"
                    placeholder={addRateType === 'percent' ? 'Örnek: 10' : 'Örnek: 150'}
                    required
                    autoFocus
                  />
                  {addRateType === 'percent' && addRateValue && (
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Her 1.000₺ randevu için → {formatCurrency(1000 * Number(addRateValue) / 100)} prim
                    </p>
                  )}
                </div>

                {addError && (
                  <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                    {addError}
                  </div>
                )}

                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">İptal</button>
                  <button type="submit" disabled={addSaving} className="btn-primary flex-1">
                    {addSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin inline" />}
                    Ekle
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
