'use client'

import { useState, useEffect, useId } from 'react'
import { ResponsiveContainer, AreaChart, Area, Tooltip } from 'recharts'

interface SparklineProps {
  data: number[]
  color: string
  height?: number
  labels?: string[]
  unit?: string
}

function CustomTooltip({ active, payload, unit }: any) {
  if (!active || !payload?.length) return null
  const item = payload[0]?.payload
  return (
    <div className="rounded-lg bg-gray-900 dark:bg-gray-800 px-2.5 py-1.5 shadow-lg border border-gray-700 z-50">
      {item?.name && <p className="text-[10px] text-gray-400 mb-0.5">{item.name}</p>}
      <p className="text-xs font-semibold text-white">
        {item?.v}{unit || ''}
      </p>
    </div>
  )
}

export function Sparkline({ data, color, height = 48, labels, unit }: SparklineProps) {
  const [mounted, setMounted] = useState(false)
  const gradientId = useId().replace(/:/g, '')

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!data || data.every(v => v === 0)) return null
  if (!mounted) return <div style={{ height: `${height}px` }} />

  const chartData = data.map((v, i) => ({ v, name: labels?.[i] || '' }))

  return (
    <div className="[&_svg]:outline-none [&_*]:outline-none">
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.3} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Tooltip
            content={<CustomTooltip unit={unit} />}
            cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 3' }}
            allowEscapeViewBox={{ x: true, y: true }}
            wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
          />
          <Area
            type="monotone"
            dataKey="v"
            stroke={color}
            fill={`url(#${gradientId})`}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 1.5, stroke: color, fill: '#fff' }}
            isAnimationActive={true}
            animationDuration={800}
            animationEasing="ease-out"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
