'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

/**
 * Zaman serisi için line chart — doluluk oranı, no-show trendi gibi
 * yüzdesel veya sayımsal serileri destekler.
 *
 * Tek seri dominant navy ile; ikinci seri (örn. "benchmark", "geçen dönem")
 * altın ton ile ikincil olarak çizilir.
 */

export interface TrendPoint {
  label: string
  value: number
  /** Opsiyonel ikincil seri (benchmark, target, geçen dönem) */
  compare?: number
}

interface Props {
  data: TrendPoint[]
  /** Y ekseni birim suffix'i (% veya sayı) */
  unit?: string
  /** Ana seri adı (legend'de görünür) */
  seriesName?: string
  /** İkincil seri adı */
  compareName?: string
  /** Yatay referans çizgi (hedef / sektör ortalaması) */
  benchmark?: number
  benchmarkLabel?: string
}

const PRIMARY = '#193d8f' // pulse-900
const SECONDARY = '#eab308' // gold-500
const BENCHMARK = '#94a3b8' // slate-400

export default function ChartTrend({
  data,
  unit = '',
  seriesName = 'Değer',
  compareName,
  benchmark,
  benchmarkLabel,
}: Props) {
  if (!data.length) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
        Yeterli veri yok
      </div>
    )
  }

  const hasCompare = data.some((d) => typeof d.compare === 'number')

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e5e7eb"
            className="dark:stroke-gray-700"
          />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => `${v}${unit}`}
            domain={unit === '%' ? [0, 100] : ['auto', 'auto']}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload || !payload.length) return null
              return (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 text-xs">
                  <div className="font-medium text-gray-900 dark:text-gray-100">
                    {label}
                  </div>
                  {payload.map((p) => (
                    <div
                      key={String(p.dataKey)}
                      className="mt-0.5 text-gray-700 dark:text-gray-300 tabular-nums"
                    >
                      <span
                        className="inline-block w-2 h-2 rounded-sm mr-1.5 align-middle"
                        style={{ backgroundColor: String(p.color) }}
                      />
                      {p.name}:{' '}
                      <span className="font-semibold">
                        {Number(p.value).toFixed(1)}
                        {unit}
                      </span>
                    </div>
                  ))}
                </div>
              )
            }}
          />
          {hasCompare && (
            <Legend
              verticalAlign="top"
              height={24}
              iconType="rect"
              wrapperStyle={{ fontSize: 11 }}
            />
          )}
          {typeof benchmark === 'number' && (
            <ReferenceLine
              y={benchmark}
              stroke={BENCHMARK}
              strokeDasharray="4 4"
              label={
                benchmarkLabel
                  ? {
                      value: benchmarkLabel,
                      fill: BENCHMARK,
                      fontSize: 10,
                      position: 'insideBottomRight',
                    }
                  : undefined
              }
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            name={seriesName}
            stroke={PRIMARY}
            strokeWidth={2.5}
            dot={{ r: 3, fill: PRIMARY }}
            activeDot={{ r: 5 }}
          />
          {hasCompare && (
            <Line
              type="monotone"
              dataKey="compare"
              name={compareName || 'Karşılaştırma'}
              stroke={SECONDARY}
              strokeWidth={2}
              strokeDasharray="4 4"
              dot={{ r: 2.5, fill: SECONDARY }}
              activeDot={{ r: 4 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
