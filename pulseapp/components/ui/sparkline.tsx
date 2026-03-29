'use client'

import { ResponsiveContainer, AreaChart, Area } from 'recharts'

export function Sparkline({ data, color, height = 48 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.every(v => v === 0)) return null
  const chartData = data.map(v => ({ v }))
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.1} strokeWidth={1.5} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
