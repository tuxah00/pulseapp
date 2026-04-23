'use client'

import { useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react'
import type { InsightAction, InsightBlock, InsightSeverity } from '@/lib/insights/types'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useRouter } from 'next/navigation'

/**
 * İş Zekası panelinin ortak bölüm bileşeni.
 *
 * Layout (desktop): sol %60 grafik · sağ %40 öneri metni + aksiyon butonları
 * Layout (mobil):  grafik üstte, öneri + aksiyonlar altta
 *
 * Her bölüm aynı üç parçayı sunar:
 *   1. chart — bölümün grafiği (recharts wrapper'ı)
 *   2. insight — template motorundan gelen başlık + metin + highlights
 *   3. actions — "Asistan aksiyonu oluştur" butonları (navigate dışı kind'lar
 *      /api/insights/apply'a POST eder, navigate doğrudan push yapar)
 *
 * "AI ile detaylandır" butonu opsiyoneldir; basılınca block.message yerini
 * AI rafine metni alır (cache'li, 1 saat).
 */

interface Props {
  title: string
  description?: string
  chart: ReactNode
  insight: InsightBlock | null
  /** Opsiyonel — null/undefined olursa insight.actions kullanılır. */
  actions?: InsightAction[]
  /** Sağ panelin üstünde gösterilen rozet (örn. "Son 30 gün") */
  meta?: ReactNode
  /** Bölüm üst aksiyonları (period selector vb.) */
  headerExtra?: ReactNode
  loading?: boolean
  error?: string | null
}

const SEVERITY_STYLES: Record<
  InsightSeverity,
  { label: string; badge: string; border: string }
> = {
  critical: {
    label: 'Kritik',
    badge: 'bg-danger-100 text-danger-700 dark:bg-danger-900/30 dark:text-danger-300',
    border: 'border-danger-200 dark:border-danger-800/70',
  },
  high: {
    label: 'Yüksek',
    badge: 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-300',
    border: 'border-warning-200 dark:border-warning-800/70',
  },
  normal: {
    label: 'Öneri',
    badge: 'bg-pulse-100 text-pulse-900 dark:bg-pulse-900/40 dark:text-pulse-300',
    border: 'border-pulse-100 dark:border-pulse-900/60',
  },
  info: {
    label: 'Bilgi',
    badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    border: 'border-gray-200 dark:border-gray-700',
  },
}

export default function InsightSection({
  title,
  description,
  chart,
  insight,
  actions,
  meta,
  headerExtra,
  loading,
  error,
}: Props) {
  const router = useRouter()
  const { confirm } = useConfirm()
  const [applyingKey, setApplyingKey] = useState<string | null>(null)
  const [appliedKeys, setAppliedKeys] = useState<Set<string>>(new Set())
  const [applyError, setApplyError] = useState<string | null>(null)

  const [refineState, setRefineState] = useState<{
    loading: boolean
    text: string | null
    cached: boolean
    error: string | null
  }>({ loading: false, text: null, cached: false, error: null })

  const effectiveActions = actions ?? insight?.actions ?? []
  const sev = insight ? SEVERITY_STYLES[insight.severity] : SEVERITY_STYLES.info

  const displayedText = refineState.text ?? insight?.message ?? ''

  async function handleApply(action: InsightAction) {
    if (action.kind === 'navigate') {
      if (action.href) router.push(action.href)
      return
    }
    if (!insight) return

    const ok = await confirm({
      title: 'Aksiyonu kuyruğa ekle',
      message: `"${action.label}" aksiyonu onay kuyruğuna eklenecek. Devam edilsin mi?`,
      confirmText: 'Kuyruğa Ekle',
      cancelText: 'Vazgeç',
    })
    if (!ok) return

    setApplyingKey(action.key)
    setApplyError(null)
    try {
      const res = await fetch('/api/insights/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: action.kind,
          payload: action.payload,
          title: action.label,
          templateKey: insight.template_key,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setApplyError(data?.error || 'Aksiyon eklenemedi')
      } else {
        setAppliedKeys((prev) => {
          const next = new Set(prev)
          next.add(action.key)
          return next
        })
        window.dispatchEvent(
          new CustomEvent('pulse-toast', {
            detail: {
              type: 'system',
              title: 'Kuyruğa eklendi',
              body: 'Aksiyon onay bekliyor.',
            },
          }),
        )
        window.dispatchEvent(new CustomEvent('pulse-pending-actions-changed'))
      }
    } catch (err) {
      setApplyError(err instanceof Error ? err.message : 'Hata oluştu')
    } finally {
      setApplyingKey(null)
    }
  }

  async function handleRefine() {
    if (!insight) return
    setRefineState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await fetch('/api/ai/insights-refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          block: {
            template_key: insight.template_key,
            category: insight.category,
            severity: insight.severity,
            title: insight.title,
            message: insight.message,
          },
          extra: insight.refineContext,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || 'Rafinman başarısız')
      }
      setRefineState({
        loading: false,
        text: data.text ?? insight.message,
        cached: Boolean(data.cached),
        error: null,
      })
    } catch (err) {
      setRefineState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : 'Rafinman başarısız',
      }))
    }
  }

  return (
    <section className="card cursor-default overflow-hidden">
      <header className="flex items-start justify-between gap-3 px-5 pt-5">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
          {description && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {description}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {meta}
          {headerExtra}
        </div>
      </header>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-5 gap-5 px-5 pb-5">
        <div className="lg:col-span-3 min-h-[260px]">
          {loading ? (
            <div className="h-64 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Yükleniyor…
            </div>
          ) : error ? (
            <div className="h-64 flex items-center justify-center text-sm text-danger-600 dark:text-danger-400">
              <AlertTriangle className="w-4 h-4 mr-2" />
              {error}
            </div>
          ) : (
            chart
          )}
        </div>

        <div className="lg:col-span-2">
          {insight ? (
            <div
              className={`rounded-xl border ${sev.border} bg-gray-50/60 dark:bg-gray-900/40 p-4 flex flex-col gap-3 h-full`}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sev.badge}`}
                >
                  {sev.label}
                </span>
                {refineState.cached && (
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> AI (önbellek)
                  </span>
                )}
              </div>

              <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                {insight.title}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
                {displayedText}
              </p>

              {insight.highlights && insight.highlights.length > 0 && (
                <ul className="flex flex-wrap gap-1.5">
                  {insight.highlights.map((h, i) => (
                    <li
                      key={i}
                      className="text-[11px] text-pulse-900 dark:text-pulse-300 bg-pulse-50 dark:bg-pulse-950/40 border border-pulse-100 dark:border-pulse-900/60 px-2 py-0.5 rounded-full tabular-nums"
                    >
                      {h}
                    </li>
                  ))}
                </ul>
              )}

              {applyError && (
                <div className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {applyError}
                </div>
              )}

              {refineState.error && (
                <div className="text-xs text-danger-600 dark:text-danger-400 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" /> {refineState.error}
                </div>
              )}

              {effectiveActions.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 mt-auto">
                  {effectiveActions.map((action) => {
                    const applied = appliedKeys.has(action.key)
                    const applying = applyingKey === action.key
                    const primaryCls =
                      'bg-pulse-900 hover:bg-pulse-800 text-white disabled:bg-pulse-900/60'
                    const ghostCls =
                      'bg-white dark:bg-gray-800 text-pulse-900 dark:text-pulse-300 border border-pulse-200 dark:border-pulse-900/60 hover:bg-pulse-50 dark:hover:bg-pulse-950/40'
                    return (
                      <button
                        key={action.key}
                        type="button"
                        onClick={() => handleApply(action)}
                        disabled={applying || applied}
                        className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 transition-colors disabled:opacity-60 ${
                          action.primary ? primaryCls : ghostCls
                        }`}
                      >
                        {applied ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" /> Eklendi
                          </>
                        ) : applying ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Ekleniyor
                          </>
                        ) : (
                          <>
                            {action.label} <ArrowRight className="w-3.5 h-3.5" />
                          </>
                        )}
                      </button>
                    )
                  })}

                  <button
                    type="button"
                    onClick={handleRefine}
                    disabled={refineState.loading}
                    className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300 disabled:opacity-60 ml-auto"
                  >
                    {refineState.loading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    AI ile detaylandır
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/40 p-4 h-full flex items-center justify-center text-center text-sm text-gray-500 dark:text-gray-400">
              Bu bölüm için henüz yeterli veri yok.
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
