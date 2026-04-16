'use client'

import React from 'react'

interface SectionHeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
  icon?: React.ComponentType<{ className?: string }>
}

export function SectionHeader({ title, subtitle, action, icon: Icon }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {Icon ? <Icon className="h-5 w-5 text-pulse-900 dark:text-pulse-300 flex-shrink-0" /> : null}
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
            {title}
          </h2>
        </div>
        {subtitle ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="flex-shrink-0">{action}</div> : null}
    </div>
  )
}
