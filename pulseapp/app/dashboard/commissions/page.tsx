'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import {
  BadgePercent, Calculator, Check, RefreshCw, Loader2,
  Settings, ChevronDown, Users, TrendingUp, Clock, X
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/utils'
import { CustomSelect } from '@/components/ui/custom-select'
import EmptyState from '@/components/ui/empty-state'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })
}

const periodOptions = Array.from({ length: 24 }, (_, i) => {
  const d = new Date()
  d.setMonth(d.getMonth() - i)
  const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  return { value: val, label: formatPeriod(val) }
})

export default function CommissionsPage() {
  const { businessId, permissions } = useBusinessContext()
  const { confirm } = useConfirm()

  requirePermission(permissions, 'commissions')

  const [earnings, setEarnings] = useState<CommissionEarning[]>([])
  const [loading, setLoading] = useState(true)
  const [calculating, setCalculating] = useState(false)

  const [calcPeriod, setCalcPeriod] = useState(getCurrentPeriod())
  const [filterPeriod, setFilterPeriod] = useState('all')
  const [filterStaff, setFilterStaff] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')

  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([])

  const toast = (type: string, title: string, body?: string) =>
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type, title, body } }))

  const fetchEarnings = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch('/api/commissions/earnings')
      if (!res.ok) throw new Error('Veriler yüklenemedi')
      const data = await res.json()
      setEarnings(data.earnings || [])
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    } finally {
      setLoading(false)
    }
  }, [businessId])

  const fetchStaff = useCallback(async () => {
    if (!businessId) return
    const supabase = createClient()
    const { data } = await supabase
      .from('staff_members')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    setStaffOptions(data || [])
  }, [businessId])

  useEffect(() => {
    fetchEarnings()
    fetchStaff()
  }, [fetchEarnings, fetchStaff])

  const handleCalculate = async () => {
    setCalculating(true)
    try {
      const res = await fetch('/api/commissions/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: calcPeriod }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Hesaplama başarısız')
      }
      toast('system', 'Prim Hesaplandı', `${formatPeriod(calcPeriod)} dönemi güncellendi`)
      await fetchEarnings()
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    } finally {
      setCalculating(false)
    }
  }

  const handleTogglePaid = async (earning: CommissionEarning) => {
    const newStatus = earning.status === 'paid' ? 'pending' : 'paid'
    const staffName = (earning.staff_members as any)?.name || 'Personel'

    const ok = await confirm({
      title: newStatus === 'paid' ? 'Ödendi Olarak İşaretle?' : 'Ödemeyi Geri Al?',
      message: newStatus === 'paid'
        ? `${staffName} — ${formatPeriod(earning.period)} dönemine ait ${formatCurrency(earning.commission_total)} prim ödenmiş olarak kaydedilecek.`
        : `${staffName} — ${formatPeriod(earning.period)} dönemi ödeme durumu "Bekliyor" olarak değiştirilecek.`,
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
      if (!res.ok) throw new Error('Güncellenemedi')
      setEarnings(prev =>
        prev.map(e =>
          e.id === earning.id
            ? { ...e, status: newStatus, paid_at: newStatus === 'paid' ? new Date().toISOString() : null }
            : e
        )
      )
      toast('system', newStatus === 'paid' ? 'Prim Ödendi ✓' : 'Ödeme Geri Alındı')
    } catch (e: any) {
      toast('error', 'Hata', e.message)
    }
  }

  // Filtered earnings
  const filtered = useMemo(() => {
    return earnings.filter(e => {
      if (filterPeriod !== 'all' && e.period !== filterPeriod) return false
      if (filterStaff !== 'all' && e.staff_id !== filterStaff) return false
      if (filterStatus !== 'all' && e.status !== filterStatus) return false
      return true
    })
  }, [earnings, filterPeriod, filterStaff, filterStatus])

  // Summary stats
  const stats = useMemo(() => {
    const currentYear = new Date().getFullYear().toString()
    const totalPending = earnings
      .filter(e => e.status === 'pending')
      .reduce((s, e) => s + e.commission_total, 0)
    const totalPaidThisYear = earnings
      .filter(e => e.status === 'paid' && e.period.startsWith(currentYear))
      .reduce((s, e) => s + e.commission_total, 0)
    const currentPeriodTotal = earnings
      .filter(e => e.period === getCurrentPeriod())
      .reduce((s, e) => s + e.commission_total, 0)
    return { totalPending, totalPaidThisYear, currentPeriodTotal }
  }, [earnings])

  const staffFilterOptions = [
    { value: 'all', label: 'Tüm Personel' },
    ...staffOptions.map(s => ({ value: s.id, label: s.name })),
  ]

  const periodFilterOptions = [
    { value: 'all', label: 'Tüm Dönemler' },
    ...periodOptions,
  ]

  const statusFilterOptions = [
    { value: 'all', label: 'Tüm Durumlar' },
    { value: 'pending', label: 'Bekliyor' },
    { value: 'paid', label: 'Ödendi' },
  ]

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Prim & Komisyon</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Aylık prim hesapla, geçmiş kayıtları görüntüle ve ödemeleri yönet.
          </p>
        </div>
        <Link
          href="/dashboard/settings/commissions"
          className="btn-secondary text-sm flex-shrink-0"
        >
          <Settings className="mr-1.5 h-4 w-4" />
          Komisyon Kuralları
        </Link>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bekleyen Prim</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(stats.totalPending)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <Check className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bu Yıl Ödenen</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(stats.totalPaidThisYear)}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-4">
          <div className="h-11 w-11 rounded-xl bg-pulse-100 dark:bg-pulse-900/30 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-5 w-5 text-pulse-900 dark:text-pulse-300" />
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Bu Ay Toplam</p>
            <p className="text-xl font-bold text-gray-900 dark:text-gray-50">{formatCurrency(stats.currentPeriodTotal)}</p>
          </div>
        </div>
      </div>

      {/* Prim Hesapla */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Calculator className="h-5 w-5 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Dönem Hesapla</h2>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[180px] max-w-[260px]">
            <label className="label">Hesaplanacak Dönem</label>
            <CustomSelect
              value={calcPeriod}
              onChange={setCalcPeriod}
              options={periodOptions}
            />
          </div>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="btn-primary"
          >
            {calculating
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <Calculator className="mr-2 h-4 w-4" />}
            Hesapla & Kaydet
          </button>
        </div>
        <p className="mt-3 text-xs text-gray-400 dark:text-gray-500">
          Seçilen ayın tamamlanmış randevuları komisyon kurallarına göre hesaplanır ve geçmiş tabloya eklenir. Ödenmiş kayıtlar yeniden hesaplanmaz.
        </p>
      </div>

      {/* Geçmiş Tablo */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-2">
            <BadgePercent className="h-5 w-5 text-pulse-900 dark:text-pulse-300" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Prim Geçmişi</h2>
            {filtered.length > 0 && (
              <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                {filtered.length} kayıt
              </span>
            )}
          </div>
        </div>

        {/* Filtreler */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="flex-1 min-w-[150px]">
            <CustomSelect
              value={filterPeriod}
              onChange={setFilterPeriod}
              options={periodFilterOptions}
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <CustomSelect
              value={filterStaff}
              onChange={setFilterStaff}
              options={staffFilterOptions}
            />
          </div>
          <div className="flex-1 min-w-[140px]">
            <CustomSelect
              value={filterStatus}
              onChange={setFilterStatus}
              options={statusFilterOptions}
            />
          </div>
          {(filterPeriod !== 'all' || filterStaff !== 'all' || filterStatus !== 'all') && (
            <button
              onClick={() => { setFilterPeriod('all'); setFilterStaff('all'); setFilterStatus('all') }}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              <X className="h-3.5 w-3.5" /> Filtreyi Temizle
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<BadgePercent className="h-7 w-7" />}
            title="Kayıt bulunamadı"
            description={earnings.length === 0
              ? 'Henüz prim hesaplaması yapılmamış. Yukarıdan bir dönem seçerek hesaplama başlatın.'
              : 'Seçilen filtrelere uygun kayıt yok.'}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Dönem</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Personel</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Randevu</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Ciro</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Prim</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Durum</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Ödeme Tarihi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filtered.map((earning) => {
                  const staffName = (earning.staff_members as any)?.name || '—'
                  return (
                    <tr
                      key={earning.id}
                      className="bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
                    >
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {formatPeriod(earning.period)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-pulse-900 flex items-center justify-center flex-shrink-0">
                            <span className="text-xs font-bold text-white">
                              {staffName.slice(0, 1).toUpperCase()}
                            </span>
                          </div>
                          <span className="text-gray-900 dark:text-gray-100">{staffName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {earning.appointment_count}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">
                        {formatCurrency(earning.total_revenue)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-semibold text-pulse-900 dark:text-pulse-300">
                          {formatCurrency(earning.commission_total)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => handleTogglePaid(earning)}
                          className={cn(
                            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors cursor-pointer',
                            earning.status === 'paid'
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                          )}
                        >
                          {earning.status === 'paid'
                            ? <><Check className="h-3 w-3" />Ödendi</>
                            : <><Clock className="h-3 w-3" />Bekliyor</>}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {earning.paid_at ? formatDate(earning.paid_at) : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {/* Toplam satırı */}
              {filtered.length > 1 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <td className="px-4 py-3 font-semibold text-gray-900 dark:text-gray-100" colSpan={2}>
                      Toplam
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {filtered.reduce((s, e) => s + e.appointment_count, 0)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">
                      {formatCurrency(filtered.reduce((s, e) => s + e.total_revenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-pulse-900 dark:text-pulse-300">
                      {formatCurrency(filtered.reduce((s, e) => s + e.commission_total, 0))}
                    </td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
