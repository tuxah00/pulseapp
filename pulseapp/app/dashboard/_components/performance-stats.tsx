'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { Clock, TrendingUp } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

export default function PerformanceStats() {
  const { businessId, loading: ctxLoading } = useBusinessContext()
  const [appointments, setAppointments] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!businessId) return
    const start = new Date()
    start.setDate(start.getDate() - 30)
    const startStr = start.toISOString().split('T')[0]

    const [aptRes, svcRes] = await Promise.all([
      supabase.from('appointments')
        .select('status, start_time, service_id')
        .eq('business_id', businessId)
        .gte('appointment_date', startStr)
        .is('deleted_at', null),
      supabase.from('services')
        .select('id, name, price')
        .eq('business_id', businessId)
        .eq('is_active', true),
    ])
    if (aptRes.data) setAppointments(aptRes.data)
    if (svcRes.data) setServices(svcRes.data)
    setLoading(false)
  }, [businessId])

  useEffect(() => { if (!ctxLoading) fetchData() }, [fetchData, ctxLoading])

  if (loading) return null

  const completed = appointments.filter(a => a.status === 'completed')
  const noShow = appointments.filter(a => a.status === 'no_show')
  const cancelled = appointments.filter(a => a.status === 'cancelled')
  const total = appointments.length
  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0
  const noShowRate = total > 0 ? Math.round((noShow.length / total) * 100) : 0

  // Peak hours
  const hourDist = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 8
    const count = appointments.filter(a => parseInt(a.start_time?.split(':')[0] || '0') === hour).length
    return { hour: `${String(hour).padStart(2, '0')}:00`, count }
  })
  const maxHour = Math.max(...hourDist.map(h => h.count), 1)
  const topHours = [...hourDist].sort((a, b) => b.count - a.count).slice(0, 3)

  // Popular services
  const serviceStats = services.map(svc => {
    const count = completed.filter(a => a.service_id === svc.id).length
    return { name: svc.name, count, revenue: count * (svc.price || 0) }
  }).filter(s => s.count > 0).sort((a, b) => b.count - a.count).slice(0, 5)

  if (total === 0) return null

  return (
    <div className="space-y-4">
      {/* Performans oranları */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Son 30 Gün Performansı</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-xl font-bold text-green-600 dark:text-green-400">
              %{completionRate}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Tamamlanma</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-red-600 dark:text-red-400">
              %{noShowRate}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Gelmeme</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">{cancelled.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">İptal</p>
          </div>
        </div>
      </div>

      {/* Yoğun saatler */}
      {topHours.some(h => h.count > 0) && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> En Yoğun Saatler
          </h3>
          <div className="space-y-2">
            {topHours.filter(h => h.count > 0).map(({ hour, count }) => (
              <div key={hour} className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-500 w-12">{hour}</span>
                <div className="flex-1 bg-gray-100 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-pulse-500 h-2 rounded-full transition-all"
                    style={{ width: `${(count / maxHour) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-gray-500 w-6 text-right">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* En popüler hizmetler */}
      {serviceStats.length > 0 && (
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Popüler Hizmetler
          </h3>
          <div className="space-y-2">
            {serviceStats.map(({ name, count, revenue }, i) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-gray-400 w-4">{i + 1}.</span>
                  <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{name}</span>
                </div>
                <div className="flex items-center gap-2 ml-2 flex-shrink-0">
                  <span className="text-xs text-gray-500">{count} randevu</span>
                  {revenue > 0 && (
                    <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(revenue)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
