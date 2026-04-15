'use client'

import { useEffect, useState } from 'react'
import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import type { MonthlyRevenuePoint } from '@/lib/analytics/insights'
import { formatCurrency } from '@/lib/utils'

interface Props {
  data: MonthlyRevenuePoint[]
}

const DEMAND_COLORS: Record<string, string> = {
  peak: 'rgba(239,68,68,0.08)',   // kırmızı - zirve
  high: 'rgba(245,158,11,0.08)',  // sarı - yüksek
  normal: 'transparent',
  low: 'rgba(59,130,246,0.05)',   // mavi - düşük
}

export default function SeasonalChart({ data }: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) {
    return <div className="h-64 bg-gray-50 dark:bg-gray-800 rounded-lg animate-pulse" />
  }

  if (!data || data.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-sm text-gray-500">
        Yeterli veri yok
      </div>
    )
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => {
              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
              return String(v)
            }}
          />
          <Tooltip
            formatter={(value, name) => {
              if (name === 'revenue') return [formatCurrency(Number(value)), 'Gelir']
              return [value as any, String(name)]
            }}
            labelFormatter={(label, payload) => {
              const row: any = payload?.[0]?.payload
              const yoy = row?.yoy_delta
              const note = row?.demand_note
              const yoyTxt = yoy != null ? ` (YoY ${yoy > 0 ? '+' : ''}${yoy.toFixed(1)}%)` : ''
              return `${label}${yoyTxt}${note ? ' — ' + note : ''}`
            }}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />

          {/* Mevsimsel bölgeler: aynı demand'li ardışık ayları ReferenceArea ile boyar */}
          {data.map((d, i) => {
            if (d.demand === 'normal') return null
            const color = DEMAND_COLORS[d.demand] || 'transparent'
            return (
              <ReferenceArea
                key={`${d.month}-${i}`}
                x1={d.label}
                x2={d.label}
                fill={color}
                fillOpacity={1}
                strokeOpacity={0}
              />
            )
          })}

          <Line
            type="monotone"
            dataKey="revenue"
            stroke="#193d8f"
            strokeWidth={2.5}
            dot={{ r: 3, fill: '#193d8f' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
