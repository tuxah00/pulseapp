'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

/**
 * Yatay bar chart — hizmet/kampanya/mesaj akışı sıralamaları için.
 *
 * Dominant renk brand navy (pulse-900). `highlightKeys` kümesinde olanlar
 * altın vurgu alır (örn. "bu kampanya pozitif ROI getirdi").
 */

export interface BarDatum {
  key: string
  label: string
  value: number
  /** Opsiyonel — "12 seans", "%34 dönüşüm" gibi tooltip ek bilgisi */
  meta?: string
}

interface Props {
  data: BarDatum[]
  /** Değerleri para birimi olarak biçimle */
  currency?: boolean
  /** Altın vurgu alacak anahtarlar (örn. en iyi/en kötü performans) */
  highlightKeys?: string[]
  /** Çubukların varsayılan rengi */
  color?: string
  /** Maksimum gösterilecek çubuk sayısı (daha fazla olursa tepeden kesilir) */
  limit?: number
  /** Değer formatlayıcısı (currency=false iken kullanılır) */
  valueFormatter?: (v: number) => string
}

const PRIMARY = '#193d8f' // pulse-900
const HIGHLIGHT = '#eab308' // gold-500

export default function ChartBar({
  data,
  currency,
  highlightKeys,
  color = PRIMARY,
  limit = 8,
  valueFormatter,
}: Props) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Yeterli veri yok
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.value - a.value).slice(0, limit)
  const highlight = new Set(highlightKeys ?? [])
  const heightPx = Math.max(220, sorted.length * 36 + 40)

  const formatValue = (v: number): string => {
    if (currency) return formatCurrency(v)
    if (valueFormatter) return valueFormatter(v)
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`
    return v.toLocaleString('tr-TR')
  }

  return (
    <div className="w-full" style={{ height: heightPx }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ top: 8, right: 40, left: 8, bottom: 8 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            horizontal={false}
            stroke="#e5e7eb"
            className="dark:stroke-gray-700"
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => {
              if (currency) {
                if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M₺`
                if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K₺`
                return `${v}₺`
              }
              if (valueFormatter) return valueFormatter(Number(v))
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
              return String(v)
            }}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 12 }}
            width={120}
            tickFormatter={(v: string) => (v.length > 18 ? `${v.slice(0, 17)}…` : v)}
          />
          <Tooltip
            cursor={{ fill: 'rgba(25, 61, 143, 0.06)' }}
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const row = payload[0].payload as BarDatum
              return (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 text-xs">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-gray-700 dark:text-gray-300 tabular-nums">
                    {formatValue(row.value)}
                  </div>
                  {row.meta && (
                    <div className="mt-0.5 text-gray-500 dark:text-gray-400">
                      {row.meta}
                    </div>
                  )}
                </div>
              )
            }}
          />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={20}>
            {sorted.map((entry) => (
              <Cell
                key={entry.key}
                fill={highlight.has(entry.key) ? HIGHLIGHT : color}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
