'use client'

import { useEffect, useState } from 'react'
import {
  TrendingUp, Users, Activity, Layers, Loader2, AlertTriangle,
  Sparkles, Calendar, Target, Lightbulb,
} from 'lucide-react'
import type { InsightsSummary, Recommendation } from '@/lib/analytics/insights'
import StrategyCard from '@/components/dashboard/insights/strategy-card'
import SeasonalChart from '@/components/dashboard/insights/seasonal-chart'
import QuadrantTable from '@/components/dashboard/insights/quadrant-table'
import CohortHeatmap from '@/components/dashboard/insights/cohort-heatmap'

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'good'
}

function StatCard({ icon, label, value, hint, tone = 'default' }: StatCardProps) {
  const toneClass =
    tone === 'warning' ? 'text-amber-600 dark:text-amber-400' :
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
    'text-pulse-900 dark:text-pulse-300'
  return (
    <div className="card p-4 cursor-default">
      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
        {icon}
        <span>{label}</span>
      </div>
      <div className={`text-2xl font-semibold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">{hint}</div>}
    </div>
  )
}

function fmtPct(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

export default function InsightsPage() {
  const [data, setData] = useState<InsightsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/insights/summary')
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || `Veri alınamadı (${res.status})`)
        }
        const json = await res.json()
        if (!cancelled) setData(json)
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Hata oluştu')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 animate-spin text-pulse-900 dark:text-pulse-300" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="card p-6 flex items-start gap-3 border-red-200 dark:border-red-800 cursor-default">
        <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
        <div>
          <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
            İş Zekası yüklenemedi
          </div>
          <div className="text-xs text-gray-600 dark:text-gray-400">
            {error || 'Bilinmeyen hata'}
          </div>
        </div>
      </div>
    )
  }

  const topRecs = data.recommendations.slice(0, 3)
  const restRecs = data.recommendations.slice(3)
  const ctx = data.seasonal.current_context

  return (
    <div className="space-y-6">
      {/* Başlık */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-pulse-900 dark:text-pulse-300" />
          İş Zekası
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Stratejik içgörüler ve kâr odaklı öneriler — sektör + veri + mevsim bağlamında.
        </p>
      </div>

      {/* Asistan Özeti — top 3 öneri */}
      {topRecs.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Öncelikli Öneriler
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {topRecs.map(rec => (
              <StrategyCard key={rec.id} rec={rec} compact />
            ))}
          </div>
        </section>
      )}

      {/* KPI Şeridi */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Stratejik KPI&apos;lar
          </h2>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<TrendingUp className="w-4 h-4" />}
            label="Kâr Marjı"
            value={fmtPct(data.kpi.margin_percentage)}
            hint="Dönem faturaları − giderler"
            tone={
              data.kpi.margin_percentage == null ? 'default' :
              data.kpi.margin_percentage >= 30 ? 'good' :
              data.kpi.margin_percentage < 15 ? 'warning' : 'default'
            }
          />
          <StatCard
            icon={<Activity className="w-4 h-4" />}
            label="Doluluk"
            value={fmtPct(data.kpi.occupancy_percentage)}
            hint="Dolu slot / toplam kapasite"
            tone={
              data.kpi.occupancy_percentage == null ? 'default' :
              data.kpi.occupancy_percentage >= 70 ? 'good' :
              data.kpi.occupancy_percentage < 40 ? 'warning' : 'default'
            }
          />
          <StatCard
            icon={<Users className="w-4 h-4" />}
            label="Müşteri Elde Tutma"
            value={fmtPct(data.kpi.retention_percentage)}
            hint="90 gün içinde tekrar gelme"
            tone={
              data.kpi.retention_percentage == null ? 'default' :
              data.kpi.retention_percentage >= 40 ? 'good' :
              data.kpi.retention_percentage < 20 ? 'warning' : 'default'
            }
          />
          <StatCard
            icon={<Layers className="w-4 h-4" />}
            label="Hizmet Konsantrasyonu"
            value={fmtPct(data.kpi.service_concentration)}
            hint="En üst hizmetin gelir payı"
            tone={
              data.kpi.service_concentration == null ? 'default' :
              data.kpi.service_concentration > 60 ? 'warning' : 'default'
            }
          />
        </div>
      </section>

      {/* Mevsimsel Tahmin */}
      <section className="card p-4 cursor-default space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              12 Aylık Trend ve Mevsim
            </h2>
          </div>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            Şu an: <strong>{ctx.current_label}</strong> — talep <strong>{ctx.current_demand}</strong>
          </span>
        </div>
        <SeasonalChart data={data.seasonal.monthly} />
        {ctx.current_note && (
          <p className="text-xs text-gray-600 dark:text-gray-400 italic">
            {ctx.current_note}
          </p>
        )}
        {ctx.upcoming && ctx.upcoming.length > 0 && (
          <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
            <div className="font-medium text-gray-700 dark:text-gray-300">Yaklaşan:</div>
            {ctx.upcoming.map((u, i) => (
              <div key={i}>
                • <strong>{u.label}</strong> ({u.demand}) — {u.note}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Hizmet Kuadrantı */}
      <section className="space-y-2">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Hizmet Karmasında Yıldızlar ve Köpekler
          </h2>
        </div>
        <QuadrantTable rows={data.margin} />
      </section>

      {/* Kohort Heatmap */}
      <section className="card p-4 cursor-default space-y-2">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Müşteri Kohort Analizi
          </h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Her ay kazanılan müşterilerin sonraki aylarda geri dönüş oranı.
        </p>
        <CohortHeatmap cohort={data.cohort} />
      </section>

      {/* Tüm Öneriler */}
      {data.recommendations.length > 3 && (
        <section className="space-y-2">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
            <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
              Tüm Öneriler ({data.recommendations.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {restRecs.map(rec => (
              <StrategyCard key={rec.id} rec={rec} compact />
            ))}
          </div>
        </section>
      )}

      {data.recommendations.length === 0 && (
        <div className="card p-6 text-center cursor-default">
          <Sparkles className="w-8 h-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Şu an için aktif bir öneri yok. Daha fazla veri biriktikçe stratejik içgörüler burada görünecek.
          </div>
        </div>
      )}
    </div>
  )
}
