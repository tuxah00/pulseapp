'use client'

import React from 'react'
import { cn } from '@/lib/utils'

interface ViewModeOption<T extends string> {
  key: T
  icon: React.ReactNode
  label: string
}

interface ViewModeToggleProps<T extends string> {
  value: T
  onChange: (mode: T) => void
  modes: ViewModeOption<T>[]
  className?: string
}

export default function ViewModeToggle<T extends string>({
  value,
  onChange,
  modes,
  className,
}: ViewModeToggleProps<T>) {
  return (
    <>
      <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
      <div className={cn('flex items-center', className)}>
        {modes.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => onChange(mode.key)}
            title={mode.label}
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-lg transition-colors',
              value === mode.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
            )}
          >
            {mode.icon}
          </button>
        ))}
      </div>
    </>
  )
}
