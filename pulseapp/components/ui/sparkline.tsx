'use client'

import { useState, useEffect, useId } from 'react'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'

export function Sparkline({ data, color, height = 48, showTooltip = false }: { data: number[]; color: string; height?: number; showTooltip?: boolean }) {
  const [mounted, setMounted] = useState(false)
  const gradientId = useId().replace(/:/g, '')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!data || data.every(v => v === 0)) return null
  if (!mounted) return <div style={{ height: `${height}px` }} />

  const chartData = data.map(v => ({ v }))

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        {showTooltip && <Tooltip contentStyle={{ display: 'none' }} />}
        <Area
          type="monotone"
          dataKey="v"
          stroke={color}
          fill={`url(#${gradientId})`}
          strokeWidth={2}
          dot={false}
          isAnimationActive={true}
          animationDuration={800}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
