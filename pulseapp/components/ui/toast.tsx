'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar, Star, CreditCard, Users, Settings, Package,
  X, Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToastItem {
  id: string
  type: string
  title: string
  body: string | null
  related_id: string | null
  related_type: string | null
  created_at: number // timestamp for auto-dismiss
}

const TYPE_CONFIG: Record<string, { icon: any; bgColor: string; borderColor: string; iconColor: string }> = {
  appointment: { icon: Calendar, bgColor: 'bg-blue-50 dark:bg-blue-900/30', borderColor: 'border-blue-200 dark:border-blue-800', iconColor: 'text-blue-500' },
  review: { icon: Star, bgColor: 'bg-amber-50 dark:bg-amber-900/30', borderColor: 'border-amber-200 dark:border-amber-800', iconColor: 'text-amber-500' },
  payment: { icon: CreditCard, bgColor: 'bg-green-50 dark:bg-green-900/30', borderColor: 'border-green-200 dark:border-green-800', iconColor: 'text-green-500' },
  customer: { icon: Users, bgColor: 'bg-purple-50 dark:bg-purple-900/30', borderColor: 'border-purple-200 dark:border-purple-800', iconColor: 'text-purple-500' },
  system: { icon: Settings, bgColor: 'bg-gray-50 dark:bg-gray-800', borderColor: 'border-gray-200 dark:border-gray-700', iconColor: 'text-gray-500' },
  stock_alert: { icon: Package, bgColor: 'bg-red-50 dark:bg-red-900/30', borderColor: 'border-red-200 dark:border-red-800', iconColor: 'text-red-500' },
}

const RELATED_ROUTES: Record<string, string> = {
  appointment: '/dashboard/appointments',
  review: '/dashboard/reviews',
  customer: '/dashboard/customers',
  payment: '/dashboard/analytics',
  system: '/dashboard/notifications',
  stock_alert: '/dashboard/stoklar',
}

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 5000

export default function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const router = useRouter()

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const addToast = useCallback((detail: any) => {
    const toast: ToastItem = {
      id: detail.id || crypto.randomUUID(),
      type: detail.type || 'system',
      title: detail.title || 'Bildirim',
      body: detail.body || null,
      related_id: detail.related_id || null,
      related_type: detail.related_type || null,
      created_at: Date.now(),
    }
    setToasts(prev => {
      const next = [toast, ...prev]
      if (next.length > MAX_TOASTS) return next.slice(0, MAX_TOASTS)
      return next
    })
  }, [])

  useEffect(() => {
    function handleToastEvent(e: Event) {
      const detail = (e as CustomEvent).detail
      if (detail) addToast(detail)
    }
    window.addEventListener('pulse-toast', handleToastEvent)
    return () => window.removeEventListener('pulse-toast', handleToastEvent)
  }, [addToast])

  // Auto-dismiss
  useEffect(() => {
    if (toasts.length === 0) return
    const interval = setInterval(() => {
      const now = Date.now()
      setToasts(prev => prev.filter(t => now - t.created_at < AUTO_DISMISS_MS))
    }, 500)
    return () => clearInterval(interval)
  }, [toasts.length])

  function handleClick(toast: ToastItem) {
    const route = RELATED_ROUTES[toast.related_type || toast.type] || '/dashboard/notifications'
    router.push(route)
    removeToast(toast.id)
  }

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-80 pointer-events-none">
      {toasts.map((toast) => {
        const config = TYPE_CONFIG[toast.type] || TYPE_CONFIG.system
        const Icon = config.icon
        const elapsed = Date.now() - toast.created_at
        const progress = Math.max(0, 1 - elapsed / AUTO_DISMISS_MS)

        return (
          <div
            key={toast.id}
            className={cn(
              'pointer-events-auto rounded-xl border shadow-lg overflow-hidden cursor-pointer',
              'toast-enter',
              config.bgColor, config.borderColor,
            )}
            onClick={() => handleClick(toast)}
          >
            <div className="flex items-start gap-3 p-3">
              <div className={cn('mt-0.5 flex-shrink-0', config.iconColor)}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                  {toast.title}
                </p>
                {toast.body && (
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5 line-clamp-2">
                    {toast.body}
                  </p>
                )}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); removeToast(toast.id) }}
                className="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-white/50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-gray-200/50 dark:bg-gray-700/50">
              <div
                className={cn('h-full transition-all duration-500', config.iconColor.replace('text-', 'bg-'))}
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
