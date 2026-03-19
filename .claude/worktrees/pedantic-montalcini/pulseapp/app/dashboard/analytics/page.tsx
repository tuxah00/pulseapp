'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Loader2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, AlertTriangle, UserX, Clock, Star,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { SEGMENT_LABELS } from '@/types'

export default function AnalyticsPage() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')

  // Data
  const [appointments, setAppointments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!businessId) return

    // Dönem hesapla
    const now = new Date()
    let startDate: string
    if (period === 'week') {
      const d = new Date(now); d.setDate(d.getDate() - 7)
      startDate = d.toISOString().split('T')[0]
    } else if (period === 'month') {
      const d = new Date(now); d.setMonth(d.getMonth() - 1)
      startDate = d.toISOString().split('T')[0]
    } else {
      const d = new Date(now); d.setFullYear(d.getFullYear() - 1)
      startDate = d.toISOString().split('T')[0]
    }

    const [aptRes, custRes, revRes, svcRes] = await Promise.all([
      supabase.from('appointments').select('*, services(name, price)')
        .eq('business_id', businessId)
        .gte('appointment_date', startDate)
        .order('appointment_date'),
      supabase.from('customers').select('*')
        .eq('business_id', businessId).eq('is_active', true),
      supabase.from('reviews').select('*')
        .eq('business_id', businessId)
        .gte('created_at', startDate + 'T00:00:00'),
      supabase.from('services').select('*')
        .eq('business_id', businessId).eq('is_active', true),
    ])

    if (aptRes.data) setAppointments(aptRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (revRes.data) setReviews(revRes.data)
    if (svcRes.data) setServices(svcRes.data)
    setLoading(false)
  }, [businessId, period])

  useEffect(() => { if (!ctxLoading) fetchData() }, [fetchData, ctxLoading])

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  // Hesaplamalar
  const totalAppointments = appointments.length
  const completedApts = appointments.filter(a => a.status === 'completed')
  const cancelledApts = appointments.filter(a => a.status === 'cancelled')
  const noShowApts = appointments.filter(a => a.status === 'no_show')
  const completionRate = totalAppointments > 0 ? Math.round((completedApts.length / totalAppointments) * 100) : 0
  const noShowRate = totalAppointments > 0 ? Math.round((noShowApts.length / totalAppointments) * 100) : 0

  // Gelir
  const totalRevenue = completedApts.reduce((sum, a) => {
    return sum + (a.services?.price || 0)
  }, 0)

  // Müşteri segmentleri
  const segmentData = (['new', 'regular', 'vip', 'risk', 'lost'] as const).map(seg => ({
    segment: seg,
    label: SEGMENT_LABELS[seg],
    count: customers.filter(c => c.segment === seg).length,
  }))
  const totalCustomers = customers.length
  const riskCustomers = customers.filter(c => c.segment === 'risk' || c.segment === 'lost')

  // Yorum ortalaması
  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  // En popüler hizmetler
  const serviceStats = services.map(svc => {
    const count = appointments.filter(a => a.service_id === svc.id && a.status === 'completed').length
    const revenue = count * (svc.price || 0)
    return { ...svc, count, revenue }
  }).sort((a, b) => b.count - a.count)

  // Günlük randevu sayıları (son 7 gün)
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const dateStr = d.toISOString().split('T')[0]
    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
    return {
      date: dateStr,
      day: dayNames[d.getDay()],
      count: appointments.filter(a => a.appointment_date === dateStr).length,
    }
  })
  const maxDayCount = Math.max(...last7Days.map(d => d.count), 1)

  // Saat dağılımı
  const hourDist = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8
    const count = appointments.filter(a => {
      const h = parseInt(a.start_time?.split(':')[0] || '0')
      return h === hour
    }).length
    return { hour: `${String(hour).padStart(2, '0')}:00`, count }
  })
  const maxHourCount = Math.max(...hourDist.map(h => h.count), 1)

  const periodLabel = period === 'week' ? 'Son 7 Gün' : period === 'month' ? 'Son 30 Gün' : 'Son 1 Yıl'

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analitik</h1>
          <p className="mt-1 text-sm text-gray-500">{periodLabel} verileri</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {([['week', '7 Gün'], ['month', '30 Gün'], ['year', '1 Yıl']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                period === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Ana Metrikler */}
      <div className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<Calendar className="h-5 w-5" />} label="Randevu" value={totalAppointments} color="blue" />
        <MetricCard icon={<DollarSign className="h-5 w-5" />} label="Gelir" value={formatCurrency(totalRevenue)} color="green" />
        <MetricCard icon={<Users className="h-5 w-5" />} label="Toplam Müşteri" value={totalCustomers} color="purple" />
        <MetricCard icon={<Star className="h-5 w-5" />} label="Ort. Puan" value={avgRating + ' ★'} color="amber" />
      </div>

      {/* Performans */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <div className="card p-4 text-center">
          <p className={cn('text-2xl font-bold', completionRate >= 80 ? 'text-green-600' : completionRate >= 60 ? 'text-amber-600' : 'text-red-600')}>
            %{completionRate}
          </p>
          <p className="text-xs text-gray-500 mt-1">Tamamlanma Oranı</p>
        </div>
        <div className="card p-4 text-center">
          <p className={cn('text-2xl font-bold', noShowRate <= 5 ? 'text-green-600' : noShowRate <= 15 ? 'text-amber-600' : 'text-red-600')}>
            %{noShowRate}
          </p>
          <p className="text-xs text-gray-500 mt-1">Gelmeme Oranı</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{cancelledApts.length}</p>
          <p className="text-xs text-gray-500 mt-1">İptal Edilen</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Son 7 Gün Grafiği */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Son 7 Gün — Randevu Sayısı</h3>
          <div className="flex items-end gap-2 h-32">
            {last7Days.map(({ day, count, date }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-900">{count}</span>
                <div
                  className="w-full bg-pulse-400 rounded-t-md transition-all"
                  style={{ height: `${(count / maxDayCount) * 100}%`, minHeight: count > 0 ? '4px' : '0' }}
                />
                <span className="text-xs text-gray-500">{day}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Saat Dağılımı */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Yoğun Saatler</h3>
          <div className="flex items-end gap-1 h-32">
            {hourDist.map(({ hour, count }) => (
              <div key={hour} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-gray-900">{count > 0 ? count : ''}</span>
                <div
                  className={cn('w-full rounded-t-sm transition-all', count > 0 ? 'bg-emerald-400' : 'bg-gray-100')}
                  style={{ height: `${(count / maxHourCount) * 100}%`, minHeight: count > 0 ? '4px' : '2px' }}
                />
                <span className="text-[9px] text-gray-400">{hour.split(':')[0]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        {/* Müşteri Segmentleri */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Müşteri Dağılımı</h3>
          <div className="space-y-3">
            {segmentData.map(({ segment, label, count }) => {
              const pct = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0
              const colors: Record<string, string> = {
                new: 'bg-blue-400', regular: 'bg-green-400', vip: 'bg-amber-400', risk: 'bg-orange-400', lost: 'bg-red-400'
              }
              return (
                <div key={segment} className="flex items-center gap-3">
                  <span className="text-sm w-16 text-gray-600">{label}</span>
                  <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', colors[segment])} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-12 text-right">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Popüler Hizmetler */}
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">En Popüler Hizmetler</h3>
          {serviceStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Henüz veri yok</p>
          ) : (
            <div className="space-y-3">
              {serviceStats.slice(0, 5).map((svc, i) => (
                <div key={svc.id} className="flex items-center gap-3">
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold',
                    i === 0 ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                  )}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{svc.name}</p>
                    <p className="text-xs text-gray-500">{svc.count} randevu · <span className="text-price">{formatCurrency(svc.revenue)}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Risk Uyarısı */}
      {riskCustomers.length > 0 && (
        <div className="card p-4 border-amber-200 bg-amber-50/50">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">
              {riskCustomers.length} Müşteri Risk Altında
            </h3>
          </div>
          <p className="text-sm text-amber-700 mb-3">
            Bu müşteriler uzun süredir gelmiyor. Geri kazanma mesajı göndermeyi düşünün.
          </p>
          <div className="flex flex-wrap gap-2">
            {riskCustomers.slice(0, 8).map(c => (
              <span key={c.id} className="badge bg-amber-100 text-amber-700">
                {c.name}
              </span>
            ))}
            {riskCustomers.length > 8 && (
              <span className="badge bg-amber-100 text-amber-700">+{riskCustomers.length - 8} daha</span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    amber: 'bg-amber-50 text-amber-600',
  }
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={cn('flex h-10 w-10 items-center justify-center rounded-lg', colorMap[color])}>{icon}</div>
      <div>
        <p className="text-sm text-gray-500">{label}</p>
        <p className={cn('text-xl font-bold', color === 'green' ? 'text-price' : 'text-gray-900')}>{value}</p>
      </div>
    </div>
  )
}
