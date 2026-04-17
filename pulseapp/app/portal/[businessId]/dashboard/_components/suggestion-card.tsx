'use client'

import Link from 'next/link'
import { Clock, RefreshCw, Package, Sparkles, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PortalSuggestion {
  kind: 'recheck' | 'follow_up' | 'package_complete' | 'protocol_next'
  title: string
  subtitle: string
  priority: number
  meta?: Record<string, any>
}

const KIND_CONFIG: Record<PortalSuggestion['kind'], { icon: typeof Clock; gradient: string }> = {
  recheck: { icon: RefreshCw, gradient: 'from-emerald-500 to-teal-600' },
  follow_up: { icon: Clock, gradient: 'from-amber-500 to-orange-600' },
  package_complete: { icon: Package, gradient: 'from-pink-500 to-rose-600' },
  protocol_next: { icon: Sparkles, gradient: 'from-pulse-900 to-indigo-600' },
}

interface SuggestionCardProps {
  suggestion: PortalSuggestion
  bookHref: string
}

export function SuggestionCard({ suggestion, bookHref }: SuggestionCardProps) {
  const config = KIND_CONFIG[suggestion.kind]
  const Icon = config.icon

  return (
    <Link
      href={bookHref}
      className="group flex-shrink-0 w-72 snap-start bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-lg hover:border-pulse-900/30 dark:hover:border-pulse-700 transition-all"
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          'h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center flex-shrink-0 text-white shadow-md',
          config.gradient
        )}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 line-clamp-1">
            {suggestion.title}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
            {suggestion.subtitle}
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center justify-end gap-1 text-xs font-medium text-pulse-900 dark:text-pulse-300">
        <span>Randevu Al</span>
        <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
      </div>
    </Link>
  )
}
