'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X, Loader2, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * İşlem sonuç bildirim bileşeni — üst orta konumda gösterilir.
 * Üç durum destekler:
 *  - 'pending'  → gri, dönen spinner, otomatik kapanmaz (işlem sürerken)
 *  - 'success'  → yeşil, CheckCircle, 3.5 sn'de otomatik kapanır
 *  - 'error'    → kırmızı, AlertCircle, 6 sn'de otomatik kapanır (kullanıcının okuması için daha uzun)
 *
 * Aynı bileşen pending → success/error geçişini yumuşak yapar (id sabit kalır).
 */
export type NotifVariant = 'pending' | 'success' | 'error'

interface NotificationProps {
  show: boolean
  variant?: NotifVariant
  title: string
  body?: string
  onDismiss: () => void
}

const VARIANT_CONFIG: Record<NotifVariant, {
  containerCls: string
  iconCls: string
  titleCls: string
  bodyCls: string
  closeCls: string
  barTrackCls: string
  barFillCls: string
  Icon: typeof CheckCircle2
  spin: boolean
  autoDismissMs: number | null
}> = {
  pending: {
    containerCls: 'bg-gray-50 border-gray-200 dark:bg-gray-800/95 dark:border-gray-700',
    iconCls: 'text-gray-500 dark:text-gray-400',
    titleCls: 'text-gray-800 dark:text-gray-100',
    bodyCls: 'text-gray-600 dark:text-gray-400',
    closeCls: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700/50',
    barTrackCls: 'bg-gray-100 dark:bg-gray-700/50',
    barFillCls: 'bg-gray-400 dark:bg-gray-500',
    Icon: Loader2,
    spin: true,
    autoDismissMs: null, // pending otomatik kapanmaz
  },
  success: {
    containerCls: 'bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700',
    iconCls: 'text-green-600 dark:text-green-400',
    titleCls: 'text-green-800 dark:text-green-200',
    bodyCls: 'text-green-600 dark:text-green-400',
    closeCls: 'text-green-400 hover:text-green-600 dark:hover:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-800/50',
    barTrackCls: 'bg-green-100 dark:bg-green-800/50',
    barFillCls: 'bg-green-500 dark:bg-green-400',
    Icon: CheckCircle2,
    spin: false,
    autoDismissMs: 3500,
  },
  error: {
    containerCls: 'bg-red-50 border-red-200 dark:bg-red-900/30 dark:border-red-700',
    iconCls: 'text-red-600 dark:text-red-400',
    titleCls: 'text-red-800 dark:text-red-200',
    bodyCls: 'text-red-700 dark:text-red-300', // light modda kontrast iyileştirildi
    closeCls: 'text-red-400 hover:text-red-600 dark:hover:text-red-300 hover:bg-red-100/50 dark:hover:bg-red-800/50',
    barTrackCls: 'bg-red-100 dark:bg-red-800/50',
    barFillCls: 'bg-red-500 dark:bg-red-400',
    Icon: AlertCircle,
    spin: false,
    autoDismissMs: 0, // hata kullanıcı kapatana kadar görünsün — uzun mesajlar okunabilir
  },
}

export default function SuccessNotification({ show, variant = 'success', title, body, onDismiss }: NotificationProps) {
  const [progress, setProgress] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const config = VARIANT_CONFIG[variant]

  useEffect(() => {
    if (!show) return

    setProgress(1)

    // null veya 0 → otomatik kapanma yok (pending: işlem sürüyor; error: kullanıcı okusun)
    if (!config.autoDismissMs) return

    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 1 - elapsed / config.autoDismissMs!)
      setProgress(remaining)
    }, 50)

    timerRef.current = setTimeout(() => {
      onDismiss()
    }, config.autoDismissMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [show, title, variant, onDismiss, config.autoDismissMs])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-auto max-w-sm pointer-events-auto"
          role={variant === 'error' ? 'alert' : 'status'}
          aria-live={variant === 'error' ? 'assertive' : 'polite'}
          aria-atomic="true"
        >
          <div className={cn('rounded-xl border shadow-lg overflow-hidden', config.containerCls)}>
            <div className="flex items-center gap-3 px-4 py-3">
              <config.Icon className={cn('h-5 w-5 flex-shrink-0', config.iconCls, config.spin && 'animate-spin')} />
              <div className="flex-1 min-w-0">
                <p className={cn('text-sm font-semibold truncate', config.titleCls)}>
                  {title}
                </p>
                {body && (
                  <p className={cn('text-xs mt-0.5', config.bodyCls, variant === 'error' ? 'whitespace-pre-wrap' : 'line-clamp-2')}>
                    {body}
                  </p>
                )}
              </div>
              {/* Pending'de bile X görünsün — kullanıcı askıda kalan işlemi kapatabilsin (a11y + recovery) */}
              <button
                onClick={onDismiss}
                aria-label="Bildirimi kapat"
                className={cn('flex-shrink-0 rounded-lg p-1 transition-colors', config.closeCls)}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Progress bar — pending'de sonsuz akan, success'te geri sayım, error'da statik */}
            <div className={cn('h-0.5 overflow-hidden', config.barTrackCls)}>
              {variant === 'pending' ? (
                <div className={cn('h-full w-1/3 animate-pending-bar', config.barFillCls)} />
              ) : config.autoDismissMs ? (
                <div
                  className={cn('h-full transition-all duration-100', config.barFillCls)}
                  style={{ width: `${progress * 100}%` }}
                />
              ) : (
                <div className={cn('h-full w-full', config.barFillCls)} />
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
