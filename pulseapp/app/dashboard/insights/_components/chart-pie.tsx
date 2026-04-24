'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency } from '@/lib/utils'

/**
 * Gelir/Gider/Müşteri segment dağılımları için pasta grafiği.
 *
 * Palet: brand navy (pulse-900) dominant, pulse-700/500/300 destek,
 * 10% kuralı olarak tek altın vurgu (gold-500). Renk anlam taşır:
 * dominant renk = en büyük dilim; gold = dikkat çekmek istediğimiz dilim
 * (sadece `highlightKey` set'i edildiğinde).
 */

export interface PieDatum {
  key: string
  label: string
  value: number
  /** Opsiyonel — tooltip'te "(23 seans)" gibi ek bilgi */
  meta?: string
}

interface Props {
  data: PieDatum[]
  /** Değerleri para birimi olarak biçimle */
  currency?: boolean
  /** İşaretlenmesi istenen dilim — altın vurgu alır */
  highlightKey?: string
  /** Renk paletini dışarıdan geçmek istersen */
  colors?: string[]
  /** Dilim sayısı >N ise kalanı "Diğer" altında topla */
  maxSlices?: number
}

const DEFAULT_COLORS = [
  '#193d8f', // pulse-900
  '#1746b6', // pulse-800
  '#1457e1', // pulse-700
  '#338dff', // pulse-500
  '#8ecdff', // pulse-300
  '#d9edff', // pulse-100
]

const HIGHLIGHT_COLOR = '#eab308' // gold-500

export default function ChartPie({
  data,
  currency,
  highlightKey,
  colors = DEFAULT_COLORS,
  maxSlices = 6,
}: Props) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!data.length || total <= 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Yeterli veri yok
      </div>
    )
  }

  // Büyükten küçüğe sırala, fazla dilimleri "Diğer" altında topla
  const sorted = [...data].sort((a, b) => b.value - a.value)
  const primary = sorted.slice(0, maxSlices - 1)
  const rest = sorted.slice(maxSlices - 1)
  const normalized: PieDatum[] =
    rest.length > 1
      ? [
          ...primary,
          {
            key: '__other__',
            label: 'Diğer',
            value: rest.reduce((s, d) => s + d.value, 0),
          },
        ]
      : sorted

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={normalized}
            dataKey="value"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={95}
            paddingAngle={1.5}
            stroke="transparent"
          >
            {normalized.map((entry, i) => (
              <Cell
                key={entry.key}
                fill={
                  entry.key === highlightKey
                    ? HIGHLIGHT_COLOR
                    : colors[i % colors.length]
                }
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload || !payload.length) return null
              const row = payload[0].payload as PieDatum
              const pct = total > 0 ? (row.value / total) * 100 : 0
              return (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 text-xs">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {row.label}
                  </div>
                  <div className="mt-0.5 text-gray-700 dark:text-gray-300">
                    {currency ? formatCurrency(row.value) : row.value.toLocaleString('tr-TR')}
                    <span className="text-gray-500 dark:text-gray-400 ml-1">
                      (%{pct.toFixed(1)})
                    </span>
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
        </PieChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2 text-xs">
        {normalized.map((d, i) => {
          const color =
            d.key === highlightKey ? HIGHLIGHT_COLOR : colors[i % colors.length]
          const pct = total > 0 ? (d.value / total) * 100 : 0
          return (
            <div key={d.key} className="flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: color }}
              />
              <span className="text-gray-700 dark:text-gray-300">{d.label}</span>
              <span className="text-gray-500 dark:text-gray-400 tabular-nums">
                %{pct.toFixed(1)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
