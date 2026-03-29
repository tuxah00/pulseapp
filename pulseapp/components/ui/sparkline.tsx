'use client'

import { useState, useEffect } from 'react'
import { ResponsiveContainer, AreaChart, Area } from 'recharts'

export function Sparkline({ data, color, height = 48 }: { data: number[]; color: string; height?: number }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Tüm değerler sıfırsa gösterme
  if (!data || data.every(v => v === 0)) return null

  // SSR'da placeholder — ResponsiveContainer DOM ölçümü yapamaz
  if (!mounted) return <div style={{ height: `${height}px` }} />

  const chartData = data.map(v => ({ v }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={color}
          fillOpacity={0.12}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
