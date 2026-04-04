'use client'

import React from 'react'
import { motion } from 'framer-motion'

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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-16 text-center"
    >
      <div className="relative mb-5">
        <div className="absolute inset-0 rounded-full bg-gradient-to-br from-pulse-100 to-pulse-200 dark:from-pulse-900/20 dark:to-pulse-800/20 blur-xl opacity-60" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl
                        bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900
                        border border-gray-200 dark:border-gray-700
                        text-gray-400 dark:text-gray-500 shadow-sm">
          {icon}
        </div>
      </div>
      <p className="text-base font-semibold text-gray-700 dark:text-gray-300">{title}</p>
      {description && (
        <p className="text-sm text-gray-400 dark:text-gray-600 mt-1.5 max-w-xs">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-5 btn-primary"
        >
          {action.icon && <span>{action.icon}</span>}
          {action.label}
        </button>
      )}
    </motion.div>
  )
}
