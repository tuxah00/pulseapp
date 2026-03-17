'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, TrendingUp, CheckCircle, RefreshCw, Lightbulb } from 'lucide-react'

interface Insight {
  type: 'warning' | 'opportunity' | 'success'
  text: string
}

interface Action {
  label: string
  type: string
}

interface InsightsData {
  period: string
  stats: {
    appointments: number
    new_customers: number
    no_shows: number
    top_service: string | null
    risk_customers: number
  }
  insights: Insight[]
  actions: Action[]
}

const INSIGHT_CONFIG = {
  warning: {
    icon: AlertTriangle,
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    iconColor: 'text-amber-500',
    textColor: 'text-amber-800',
  },
  opportunity: {
    icon: Lightbulb,
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    iconColor: 'text-blue-500',
    textColor: 'text-blue-800',
  },
  success: {
    icon: CheckCircle,
    bg: 'bg-green-50',
    border: 'border-green-200',
    iconColor: 'text-green-500',
    textColor: 'text-green-800',
  },
}

export default function WeeklyInsights() {
  const [data, setData] = useState<InsightsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const CACHE_KEY = 'pulse_weekly_insights'
  const CACHE_TTL = 60 * 60 * 1000 // 1 saat

  async function load(force = false) {
    // Cache kontrolü (zorla yenileme değilse)
    if (!force) {
      try {
        const cached = localStorage.getItem(CACHE_KEY)
        if (cached) {
          const { data: d, ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) {
            setData(d)
            setOpen(true)
            return
          }
        }
      } catch { /* localStorage erişimi başarısız */ }
    }

    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ai/insights')
      if (!res.ok) throw new Error('Rapor alınamadı')
      const json = await res.json()
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ data: json, ts: Date.now() }))
      } catch { /* localStorage dolu olabilir */ }
      setData(json)
      setOpen(true)
    } catch {
      setError('AI raporu şu an alınamıyor. Daha sonra tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }

  // İlk yüklemede cache'ten veya API'den çek
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!open && !loading && !data) {
    return (
      <button
        onClick={load}
        className="card w-full text-left hover:border-blue-300 transition-colors border-dashed border-2"
      >
        <div className="flex items-center gap-3 py-2">
          <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Haftalık AI Raporu</p>
            <p className="text-xs text-gray-400">İşletmenizin geçen haftasını analiz et</p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">Haftalık AI Raporu</p>
            {data?.period && <p className="text-xs text-gray-400">{data.period}</p>}
          </div>
        </div>
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          title="Yenile"
        >
          <RefreshCw className={`h-3.5 w-3.5 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
          AI raporu hazırlanıyor...
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-500 bg-red-50 p-2 rounded-lg">{error}</p>
      )}

      {data && !loading && (
        <>
          {/* Özet istatistikler */}
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">{data.stats.appointments}</p>
              <p className="text-xs text-gray-400">Randevu</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-gray-900">+{data.stats.new_customers}</p>
              <p className="text-xs text-gray-400">Yeni Müşteri</p>
            </div>
            <div className={`text-center p-2 rounded-lg ${data.stats.risk_customers > 0 ? 'bg-amber-50' : 'bg-gray-50'}`}>
              <p className={`text-lg font-bold ${data.stats.risk_customers > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {data.stats.risk_customers}
              </p>
              <p className="text-xs text-gray-400">Risk Müşteri</p>
            </div>
          </div>

          {/* AI İçgörüler */}
          {data.insights.length > 0 && (
            <div className="space-y-2">
              {data.insights.map((insight, i) => {
                const cfg = INSIGHT_CONFIG[insight.type]
                const Icon = cfg.icon
                return (
                  <div key={i} className={`flex gap-2.5 p-2.5 rounded-lg border ${cfg.bg} ${cfg.border}`}>
                    <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.iconColor}`} />
                    <p className={`text-xs leading-relaxed ${cfg.textColor}`}>{insight.text}</p>
                  </div>
                )
              })}
            </div>
          )}

          {/* Önerilenler aksiyonlar */}
          {data.actions.length > 0 && (
            <div className="space-y-1.5 border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">Önerilen Aksiyonlar</p>
              {data.actions.map((action, i) => (
                <button
                  key={i}
                  className="w-full text-left text-xs px-3 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                >
                  {action.label}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
