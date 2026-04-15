'use client'

import { useState } from 'react'
import { AlertTriangle, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import type { Recommendation } from '@/lib/analytics/insights'
import { useConfirm } from '@/lib/hooks/use-confirm'

const SEVERITY_STYLES: Record<Recommendation['severity'], { label: string; badge: string; accent: string }> = {
  critical: { label: 'Kritik', badge: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300', accent: 'border-red-200 dark:border-red-800' },
  high:     { label: 'Yüksek', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300', accent: 'border-amber-200 dark:border-amber-800' },
  medium:   { label: 'Orta',   badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300', accent: 'border-blue-200 dark:border-blue-800' },
  info:     { label: 'Bilgi',  badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', accent: 'border-gray-200 dark:border-gray-700' },
}

const FOCUS_LABELS: Record<Recommendation['focus'], string> = {
  profit: 'Kâr',
  retention: 'Elde Tutma',
  occupancy: 'Doluluk',
  seasonal: 'Mevsimsel',
  risk: 'Risk',
}

interface Props {
  rec: Recommendation
  compact?: boolean
}

export default function StrategyCard({ rec, compact = false }: Props) {
  const sev = SEVERITY_STYLES[rec.severity]
  const [expanded, setExpanded] = useState(!compact)
  const [applying, setApplying] = useState(false)
  const [applied, setApplied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { confirm } = useConfirm()

  const canApply = rec.suggested_action && rec.suggested_action.type !== 'none' && rec.suggested_action.payload

  async function handleApply() {
    if (!rec.suggested_action || !rec.suggested_action.payload) return
    const ok = await confirm({
      title: 'Aksiyonu kuyruğa ekle',
      message: `"${rec.suggested_action.label}" aksiyonu onay kuyruğuna eklenecek. Devam edilsin mi?`,
      confirmText: 'Kuyruğa Ekle',
      cancelText: 'Vazgeç',
    })
    if (!ok) return

    setApplying(true)
    setError(null)
    try {
      const res = await fetch('/api/insights/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recommendationId: rec.id,
          title: rec.title,
          type: rec.suggested_action.type,
          payload: rec.suggested_action.payload,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data?.error || 'Aksiyon eklenemedi')
      } else {
        setApplied(true)
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'system', title: 'Kuyruğa eklendi', body: 'Aksiyon onay bekliyor.' },
        }))
      }
    } catch (err: any) {
      setError(err?.message || 'Hata oluştu')
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className={`card border ${sev.accent} p-4 flex flex-col gap-2 cursor-default`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${sev.badge}`}>
            {sev.label}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {FOCUS_LABELS[rec.focus]}
          </span>
        </div>
        {applied && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Kuyruğa eklendi
          </span>
        )}
      </div>

      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {rec.title}
      </h3>

      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
        {rec.rationale}
      </p>

      {expanded && rec.evidence.length > 0 && (
        <ul className="text-xs text-gray-500 dark:text-gray-400 list-disc pl-5 space-y-0.5 mt-1">
          {rec.evidence.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}

      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <AlertTriangle className="w-3.5 h-3.5" /> {error}
        </div>
      )}

      <div className="flex items-center gap-2 pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
        {compact && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300"
          >
            {expanded ? 'Gizle' : 'Detay'}
          </button>
        )}
        {canApply && !applied && (
          <button
            type="button"
            onClick={handleApply}
            disabled={applying}
            className="btn-primary text-xs px-3 py-1.5 ml-auto flex items-center gap-1 disabled:opacity-60"
          >
            {applying ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Ekleniyor</>
            ) : (
              <>{rec.suggested_action!.label} <ArrowRight className="w-3.5 h-3.5" /></>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
