'use client'

import { Globe2, TrendingDown, TrendingUp, Newspaper } from 'lucide-react'
import type { MacroContext, MacroBriefNote } from '@/lib/analytics/macro-context'

interface Props {
  macro: MacroContext | null
}

const NOTE_ICON: Record<MacroBriefNote['kind'], string> = {
  economy: '💰',
  regulation: '📋',
  trend: '📈',
  risk: '⚠️',
}

const NOTE_LABEL: Record<MacroBriefNote['kind'], string> = {
  economy: 'Ekonomi',
  regulation: 'Regülasyon',
  trend: 'Trend',
  risk: 'Risk',
}

function formatFxTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return iso
  }
}

function formatBriefDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  } catch {
    return iso
  }
}

export default function MacroPanel({ macro }: Props) {
  if (!macro || (!macro.snapshot && !macro.brief)) {
    return (
      <div className="card p-4 cursor-default">
        <div className="flex items-center gap-2 mb-2">
          <Globe2 className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Dış Dünya</h2>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Makro veriler şu an alınamıyor. Haftalık gündem özeti Pazartesi sabahı güncellenir.
        </p>
      </div>
    )
  }

  const { snapshot, brief } = macro

  return (
    <section className="card p-4 cursor-default space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Globe2 className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
          <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            Dış Dünya — Ekonomi ve Gündem
          </h2>
        </div>
        {snapshot && (
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {snapshot.source} · {formatFxTime(snapshot.fetched_at)}
            {snapshot.stale && ' (önbellek)'}
          </span>
        )}
      </div>

      {snapshot && snapshot.fx.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {snapshot.fx.map(r => {
            const delta = r.weekly_delta_pct
            const isUp = delta != null && delta > 0
            const isDown = delta != null && delta < 0
            const deltaColor = isUp
              ? 'text-red-600 dark:text-red-400'
              : isDown
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-gray-500 dark:text-gray-400'
            const DeltaIcon = isUp ? TrendingUp : isDown ? TrendingDown : null
            return (
              <div key={r.code} className="rounded-lg border border-gray-100 dark:border-gray-800 p-3">
                <div className="text-[11px] text-gray-500 dark:text-gray-400">
                  {r.code} — {r.label}
                </div>
                <div className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-1">
                  {r.selling.toFixed(2)} ₺
                </div>
                {delta != null && DeltaIcon && (
                  <div className={`text-[11px] flex items-center gap-1 mt-1 ${deltaColor}`}>
                    <DeltaIcon className="w-3 h-3" />
                    Son 7 gün {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                  </div>
                )}
                {delta == null && (
                  <div className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">
                    Haftalık değişim verisi yok
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {brief && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Newspaper className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
              Haftalık Sektör Gündemi
            </span>
            <span className="text-[11px] text-gray-400 dark:text-gray-500">
              · {formatBriefDate(brief.generated_at)}
            </span>
          </div>
          <p className="text-sm text-gray-800 dark:text-gray-200 mb-2">
            {brief.headline}
          </p>
          {brief.notes.length > 0 && (
            <ul className="space-y-1.5">
              {brief.notes.map((n, i) => (
                <li key={i} className="flex gap-2 text-xs text-gray-600 dark:text-gray-400">
                  <span className="shrink-0" aria-hidden>{NOTE_ICON[n.kind]}</span>
                  <span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {NOTE_LABEL[n.kind]}:
                    </span>{' '}
                    {n.text}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {!brief && (
        <div className="border-t border-gray-100 dark:border-gray-800 pt-3 text-xs text-gray-500 dark:text-gray-400">
          Sektör gündem özeti henüz hazırlanmadı — haftalık özet Pazartesi sabahları güncellenir.
        </div>
      )}
    </section>
  )
}
