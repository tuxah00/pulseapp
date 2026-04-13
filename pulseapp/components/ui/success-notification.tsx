'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, X } from 'lucide-react'

interface SuccessNotificationProps {
  show: boolean
  title: string
  body?: string
  onDismiss: () => void
}

const AUTO_DISMISS_MS = 3500

export default function SuccessNotification({ show, title, body, onDismiss }: SuccessNotificationProps) {
  const [progress, setProgress] = useState(1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!show) return

    setProgress(1)

    // Progress bar countdown
    const start = Date.now()
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - start
      const remaining = Math.max(0, 1 - elapsed / AUTO_DISMISS_MS)
      setProgress(remaining)
    }, 50)

    // Auto dismiss
    timerRef.current = setTimeout(() => {
      onDismiss()
    }, AUTO_DISMISS_MS)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [show, title, onDismiss])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: '-100%', opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '-100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 500, damping: 35 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] w-auto max-w-sm pointer-events-auto"
        >
          <div className="rounded-xl border shadow-lg overflow-hidden bg-green-50 border-green-200 dark:bg-green-900/30 dark:border-green-700">
            <div className="flex items-center gap-3 px-4 py-3">
              <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-600 dark:text-green-400" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-green-800 dark:text-green-200 truncate">
                  {title}
                </p>
                {body && (
                  <p className="text-xs text-green-600 dark:text-green-400 mt-0.5 line-clamp-2">
                    {body}
                  </p>
                )}
              </div>
              <button
                onClick={onDismiss}
                className="flex-shrink-0 rounded-lg p-1 text-green-400 hover:text-green-600 dark:hover:text-green-300 hover:bg-green-100/50 dark:hover:bg-green-800/50 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            {/* Progress bar */}
            <div className="h-0.5 bg-green-100 dark:bg-green-800/50">
              <div
                className="h-full bg-green-500 dark:bg-green-400 transition-all duration-100"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
