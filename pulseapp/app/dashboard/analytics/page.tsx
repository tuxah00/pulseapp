'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Loader2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, AlertTriangle, Clock, Star, UserCheck, Minus,
  BarChart3, PieChart, Activity,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { SEGMENT_LABELS } from '@/types'

function getPeriodDates(period: 'week' | 'month' | 'year', offset = 0): { start: string; end: string } {
  const now = new Date()
  let start: Date
  let end: Date

  if (period === 'week') {
    const days = 7 * (offset + 1)
    const daysBack = 7 * offset
    start = new Date(now); start.setDate(now.getDate() - days)
    end = new Date(now); end.setDate(now.getDate() - daysBack)
  } else if (period === 'month') {
    const months = offset + 1
    const monthsBack = offset
    start = new Date(now); start.setMonth(now.getMonth() - months)
    end = new Date(now); end.setMonth(now.getMonth() - monthsBack)
  } else {
    const years = offset + 1
    const yearsBack = offset
    start = new Date(now); start.setFullYear(now.getFullYear() - years)
    end = new Date(now); end.setFullYear(now.getFullYear() - yearsBack)
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export default function AnalyticsPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'customers' | 'sources'>('overview')

  const [appointments, setAppointments] = useState<any[]>([])
  const [prevAppointments, setPrevAppointments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staffMembers, setStaffMembers] = useState<any[]>([])

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const { start, end } = getPeriodDates(period, 0)
    const { start: prevStart, end: prevEnd } = getPeriodDates(period, 1)

    const [aptRes, prevAptRes, custRes, revRes, svcRes, staffRes] = await Promise.all([
      supabase.from('appointments').select('*, services(name, price)')
        .eq('business_id', businessId).gte('appointment_date', start).lte('appointment_date', end).order('appointment_date'),
      supabase.from('appointments').select('status, services(price)')
        .eq('business_id', businessId).gte('appointment_date', prevStart).lte('appointment_date', prevEnd),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('reviews').select('*').eq('business_id', businessId).gte('created_at', start + 'T00:00:00'),
      supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true),
    ])

    if (aptRes.data) setAppointments(aptRes.data)
    if (prevAptRes.data) setPrevAppointments(prevAptRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (revRes.data) setReviews(revRes.data)
    if (svcRes.data) setServices(svcRes.data)
    if (staffRes.data) setStaffMembers(staffRes.data)
    setLoading(false)
  }, [businessId, period])

  useEffect(() => { if (!ctxLoading) fetchData() }, [fetchData, ctxLoading])

  if (permissions && !permissions.analytics) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────

  const completed = appointments.filter(a => a.status === 'completed')
  const cancelled = appointments.filter(a => a.status === 'cancelled')
  const noShow = appointments.filter(a => a.status === 'no_show')
  const total = appointments.length

  const prevCompleted = prevAppointments.filter(a => a.status === 'completed')
  const prevTotal = prevAppointments.length

  const totalRevenue = completed.reduce((s, a) => s + (a.services?.price || 0), 0)
  const prevRevenue = prevCompleted.reduce((s: number, a: any) => s + (a.services?.price || 0), 0)

  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0
  const noShowRate = total > 0 ? Math.round((noShow.length / total) * 100) : 0
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  function trend(curr: number, prev: number) {
    if (prev === 0) return 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const totalTrend = trend(total, prevTotal)
  const revenueTrend = trend(totalRevenue, prevRevenue)

  // Müşteri metrikleri
  const totalCustomers = customers.length
  const newCustomers = customers.filter(c => c.segment === 'new').length
  const returningCustomers = totalCustomers - newCustomers
  const avgCLV = totalCustomers > 0
    ? (customers.reduce((s, c) => s + (c.total_revenue || 0), 0) / totalCustomers)
    : 0
  const riskCustomers = customers.filter(c => c.segment === 'risk' || c.segment === 'lost')
  const segmentData = (['new', 'regular', 'vip', 'risk', 'lost'] as const).map(seg => ({
    segment: seg, label: SEGMENT_LABELS[seg],
    count: customers.filter(c => c.segment === seg).length,
  }))

  // Kaynak dağılımı
  const sourceCounts = { web: 0, manual: 0, phone: 0 }
  for (const a of appointments) {
    if (a.source === 'web') sourceCounts.web++
    else if (a.source === 'manual') sourceCounts.manual++
    else if (a.source === 'phone') sourceCounts.phone++
  }

  // Personel performansı
  const staffStats = staffMembers.map(sm => {
    const smApts = appointments.filter(a => a.staff_id === sm.id)
    const smCompleted = smApts.filter(a => a.status === 'completed')
    const smNoShow = smApts.filter(a => a.status === 'no_show')
    const smRevenue = smCompleted.reduce((s, a) => s + (a.services?.price || 0), 0)
    return {
      ...sm,
      total: smApts.length,
      completed: smCompleted.length,
      noShowRate: smApts.length > 0 ? Math.round((smNoShow.length / smApts.length) * 100) : 0,
      revenue: smRevenue,
    }
  }).filter(s => s.total > 0).sort((a, b) => b.completed - a.completed)

  // Günlük trend (seçilen dönemdeki günler)
  const { start } = getPeriodDates(period, 0)
  const startDate = new Date(start + 'T00:00:00')
  const dayCount = period === 'week' ? 7 : period === 'month' ? 30 : 12
  const trendDays = period === 'year'
    ? Array.from({ length: 12 }, (_, i) => {
        const d = new Date(startDate); d.setMonth(d.getMonth() + i)
        const label = d.toLocaleDateString('tr-TR', { month: 'short' })
        const ym = d.toISOString().slice(0, 7)
        return { label, count: appointments.filter(a => a.appointment_date?.startsWith(ym)).length }
      })
    : Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        const label = period === 'week'
          ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d.getDay() === 0 ? 6 : d.getDay() - 1]
          : String(d.getDate())
        return { label, count: appointments.filter(a => a.appointment_date === dateStr).length }
      })
  const maxTrend = Math.max(...trendDays.map(d => d.count), 1)

  // Saat dağılımı
  const hourDist = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8
    const count = appointments.filter(a => parseInt(a.start_time?.split(':')[0] || '0') === hour).length
    return { hour: `${String(hour).padStart(2, '0')}`, count }
  })
  const maxHour = Math.max(...hourDist.map(h => h.count), 1)

  // En popüler hizmetler
  const serviceStats = services.map(svc => {
    const count = completed.filter(a => a.service_id === svc.id).length
    return { ...svc, count, revenue: count * (svc.price || 0) }
  }).sort((a, b) => b.count - a.count)

  const periodLabel = period === 'week' ? 'Son 7 Gün' : period === 'month' ? 'Son 30 Gün' : 'Son 1 Yıl'

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Analitik</h1>
          <p className="mt-1 text-sm text-gray-500">{periodLabel} · önceki dönemle karşılaştırmalı</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {([['week', '7 Gün'], ['month', '30 Gün'], ['year', '1 Yıl']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                period === key ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Kartları (dönem karşılaştırmalı) */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<Calendar className="h-5 w-5" />} label="Randevu" value={total}
          trend={totalTrend} color="blue" />
        <KPICard icon={<DollarSign className="h-5 w-5" />} label="Gelir"
          value={formatCurrency(totalRevenue)} trend={revenueTrend} color="green" currency />
        <KPICard icon={<Users className="h-5 w-5" />} label="Toplam Müşteri" value={totalCustomers} color="purple" />
        <KPICard icon={<Star className="h-5 w-5" />} label="Ort. Puan" value={avgRating + ' ★'} color="amber" />
      </div>

      {/* Performans Oranları */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className={cn('text-2xl font-bold', completionRate >= 80 ? 'text-green-600' : completionRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
            %{completionRate}
          </p>
          <p className="text-xs text-gray-500 mt-1">Tamamlanma</p>
        </div>
        <div className="card p-4 text-center">
          <p className={cn('text-2xl font-bold', noShowRate <= 5 ? 'text-green-600' : noShowRate <= 15 ? 'text-amber-600' : 'text-red-600')}>
            %{noShowRate}
          </p>
          <p className="text-xs text-gray-500 mt-1">Gelmeme</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{cancelled.length}</p>
          <p className="text-xs text-gray-500 mt-1">İptal</p>
        </div>
      </div>

      {/* Sekmeler */}
      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700">
        {([
          ['overview', 'Genel Bakış', <BarChart3 key="o" className="h-3.5 w-3.5" />],
          ['staff', 'Personel', <Users key="s" className="h-3.5 w-3.5" />],
          ['customers', 'Müşteriler', <UserCheck key="c" className="h-3.5 w-3.5" />],
          ['sources', 'Kaynak', <PieChart key="sr" className="h-3.5 w-3.5" />],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={cn('flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-pulse-500 text-pulse-600 dark:text-pulse-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Genel Bakış Sekmesi */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Randevu Trendi */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Randevu Trendi — {periodLabel}
            </h3>
            <div className="flex items-end gap-1 h-36 overflow-x-auto">
              {trendDays.map(({ label, count }, i) => (
                <div key={i} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
                  {count > 0 && <span className="text-[9px] font-medium text-gray-700 dark:text-gray-300">{count}</span>}
                  <div className="w-full bg-pulse-400 dark:bg-pulse-500 rounded-t-sm transition-all"
                    style={{ height: `${(count / maxTrend) * 100}%`, minHeight: count > 0 ? '4px' : '0' }} />
                  <span className="text-[9px] text-gray-400">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Yoğun Saatler */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4" /> Yoğun Saatler
              </h3>
              <div className="flex items-end gap-1 h-32">
                {hourDist.map(({ hour, count }) => (
                  <div key={hour} className="flex-1 flex flex-col items-center justify-end h-full">
                    {count > 0 && <span className="text-[9px] font-medium text-gray-700 dark:text-gray-300 mb-0.5 shrink-0">{count}</span>}
                    <div className={cn('w-full rounded-t-sm transition-all', count > 0 ? 'bg-emerald-400' : 'bg-gray-100 dark:bg-gray-700')}
                      style={{ height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? '4px' : '2px' }} />
                    <span className="text-[8px] text-gray-400 mt-1 shrink-0">{hour}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Popüler Hizmetler */}
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">En Popüler Hizmetler</h3>
              {serviceStats.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-8">Henüz veri yok</p>
              ) : (
                <div className="space-y-3">
                  {serviceStats.slice(0, 5).map((svc, i) => (
                    <div key={svc.id} className="flex items-center gap-3">
                      <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
                        i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                      )}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{svc.name}</p>
                        <p className="text-xs text-gray-500">{svc.count} randevu · {formatCurrency(svc.revenue)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Personel Sekmesi */}
      {activeTab === 'staff' && (
        <div className="card p-0 overflow-hidden">
          {staffStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Bu dönem için personel randevu verisi yok</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Personel</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Toplam</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Tamamlandı</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gelmeme %</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gelir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {staffStats.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{s.total}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{s.completed}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-medium', s.noShowRate <= 5 ? 'text-green-600' : s.noShowRate <= 15 ? 'text-amber-600' : 'text-red-600')}>
                        %{s.noShowRate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium text-price">{formatCurrency(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Müşteriler Sekmesi */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Müşteri Özet Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{newCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">Yeni Müşteri</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{returningCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">Tekrar Gelen</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(avgCLV)}</p>
              <p className="text-xs text-gray-500 mt-1">Ortalama Müşteri Değeri</p>
            </div>
          </div>

          {/* Segment Dağılımı */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Müşteri Segmentleri</h3>
            <div className="space-y-3">
              {segmentData.map(({ segment, label, count }) => {
                const pct = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0
                const colors: Record<string, string> = {
                  new: 'bg-blue-400', regular: 'bg-green-400', vip: 'bg-amber-400', risk: 'bg-orange-400', lost: 'bg-red-400'
                }
                return (
                  <div key={segment} className="flex items-center gap-3">
                    <span className="text-sm w-16 text-gray-600 dark:text-gray-400">{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', colors[segment])} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-16 text-right">{count} (%{pct})</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Risk Uyarısı */}
          {riskCustomers.length > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  {riskCustomers.length} Müşteri Risk Altında
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {riskCustomers.slice(0, 10).map(c => (
                  <span key={c.id} className="badge bg-amber-100 text-amber-700">{c.name}</span>
                ))}
                {riskCustomers.length > 10 && (
                  <span className="badge bg-amber-100 text-amber-700">+{riskCustomers.length - 10} daha</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kaynak Sekmesi */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {([
              ['web', 'Online Rezervasyon', sourceCounts.web, 'blue'],
              ['manual', 'Manuel Giriş', sourceCounts.manual, 'purple'],
              ['phone', 'Telefon', sourceCounts.phone, 'green'],
            ] as const).map(([key, label, count, color]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const colorMap: Record<string, string> = { blue: 'text-blue-600', purple: 'text-purple-600', green: 'text-green-600' }
              const bgMap: Record<string, string> = { blue: 'bg-blue-100', purple: 'bg-purple-100', green: 'bg-green-100' }
              return (
                <div key={key} className="card p-4 text-center">
                  <div className={cn('inline-flex rounded-full px-3 py-1 text-2xl font-bold mb-1', colorMap[color])}>
                    {count}
                  </div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={cn('text-xs font-medium mt-1', colorMap[color])}>%{pct}</p>
                </div>
              )
            })}
          </div>

          {/* Görsel çubuk */}
          {total > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Kaynak Dağılımı</h3>
              <div className="h-6 rounded-full overflow-hidden flex">
                {sourceCounts.web > 0 && (
                  <div className="bg-blue-400 h-full" style={{ width: `${(sourceCounts.web / total) * 100}%` }} title={`Online: ${sourceCounts.web}`} />
                )}
                {sourceCounts.manual > 0 && (
                  <div className="bg-purple-400 h-full" style={{ width: `${(sourceCounts.manual / total) * 100}%` }} title={`Manuel: ${sourceCounts.manual}`} />
                )}
                {sourceCounts.phone > 0 && (
                  <div className="bg-green-400 h-full" style={{ width: `${(sourceCounts.phone / total) * 100}%` }} title={`Telefon: ${sourceCounts.phone}`} />
                )}
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Online</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />Manuel</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Telefon</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus className="h-3 w-3" />%0</span>
  if (value > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp className="h-3 w-3" />%{value}</span>
  return <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="h-3 w-3" />%{Math.abs(value)}</span>
}

function KPICard({ icon, label, value, trend, color, currency }: {
  icon: React.ReactNode; label: string; value: string | number; trend?: number; color: string; currency?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  }
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colorMap[color])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn('text-xl font-bold truncate', currency ? 'text-price' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
    </div>
  )
}
