'use client'

import React from 'react'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
    icon?: React.ReactNode
  }
}

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400 dark:text-gray-500">
        {icon}
      </div>
      <p className="text-lg font-medium text-gray-500 dark:text-gray-400">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 btn-primary"
        >
          {action.icon && <span className="mr-2">{action.icon}</span>}
          {action.label}
        </button>
      )}
    </div>
  )
}
