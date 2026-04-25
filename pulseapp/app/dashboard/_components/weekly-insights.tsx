'use client'

import { useEffect, useState } from 'react'
import { TrendingUp, RefreshCw, ArrowUp, ArrowDown } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'

interface InsightsData {
  period: string
  stats: {
    appointments: number
    new_customers: number
    risk_entered: number
    risk_exited: number
    weekly_revenue: number
  }
}

export default function WeeklyInsights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const CACHE_KEY = 'pulse_weekly_insights_v2'
  const CACHE_TTL = 30 * 60 * 1000 // 30 dk

  async function load(force = false) {
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { data: d, ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            setData(d)
            return
          }
        }
      } catch { /* localStorage erişimi başarısız */ }
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/weekly-insights')
      if (!res.ok) throw new Error('Rapor alınamadı')
      const json = await res.json()
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json, ts: Date.now() }))
      } catch { /* localStorage dolu olabilir */ }
      setData(json)
    } catch (err) {
      console.error('Weekly insights fetch error:', err)
      setError('Rapor alınamıyor.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="card space-y-3">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <TrendingUp className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">Haftalık Rapor</p>
            {data?.period && <p className="text-[11px] text-gray-400">{data.period}</p>}
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="Yenile"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Yükleniyor */}
      {loading && (
        <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
          <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-blue-500" />
          Hesaplanıyor...
        </div>
      )}

      {/* Hata */}
      {error && !loading && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded-lg">{error}</p>
      )}

      {/* İstatistikler */}
      {data && !loading && (
        <div className="grid grid-cols-2 gap-2">
          {/* Randevu */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Randevu</p>
            <p className="text-xl font-bold tabular-nums text-gray-900 dark:text-gray-100">{data.stats.appointments}</p>
          </div>

          {/* Yeni Müşteri */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Yeni Müşteri</p>
            <p className="text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">+{data.stats.new_customers}</p>
          </div>

          {/* Riskli Müşteri */}
          <div className={`rounded-xl p-3 ${
            data.stats.risk_entered > 0
              ? 'bg-amber-50 dark:bg-amber-900/20'
              : 'bg-gray-50 dark:bg-gray-800/60'
          }`}>
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1.5">Riskli Müşteri</p>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1">
                <ArrowUp className="h-3 w-3 text-red-500 shrink-0" />
                <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">{data.stats.risk_entered}</span>
                <span className="text-[10px] text-gray-400">riskli oldu</span>
              </div>
              <div className="flex items-center gap-1">
                <ArrowDown className="h-3 w-3 text-emerald-500 shrink-0" />
                <span className="text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">{data.stats.risk_exited}</span>
                <span className="text-[10px] text-gray-400">geri döndü</span>
              </div>
            </div>
          </div>

          {/* Haftalık Gelir */}
          <div className="bg-gray-50 dark:bg-gray-800/60 rounded-xl p-3">
            <p className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-1">Randevu Geliri</p>
            <p className="text-base font-bold tabular-nums text-gray-900 dark:text-gray-100 leading-tight">
              {formatCurrency(data.stats.weekly_revenue)}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
