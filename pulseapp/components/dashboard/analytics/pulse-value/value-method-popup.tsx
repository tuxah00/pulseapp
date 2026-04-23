'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, X } from 'lucide-react'
import { VALUE_METHOD_DESCRIPTIONS } from '@/lib/analytics/pulse-value-methods'

type MethodKey = keyof typeof VALUE_METHOD_DESCRIPTIONS

interface ValueMethodPopupProps {
  methodKey: MethodKey
  detail?: string
}

export function ValueMethodPopup({ methodKey, detail }: ValueMethodPopupProps) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState(false)
  const method = VALUE_METHOD_DESCRIPTIONS[methodKey]

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  function handleClose() {
    setClosing(true)
  }

  function handleAnimationEnd() {
    if (closing) {
      setOpen(false)
      setClosing(false)
    }
  }

  if (!method) return null

  return (
    <>
      <button
        type="button"
        aria-label="Nasıl hesaplandı?"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        className="inline-flex items-center justify-center p-1 rounded-full text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-400 transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          className={`modal-overlay fixed inset-0 z-[60] flex items-center justify-center p-4 ${closing ? 'closing' : ''}`}
          onClick={handleClose}
          onAnimationEnd={handleAnimationEnd}
        >
          <div
            className={`modal-content card w-full max-w-md p-5 space-y-3 relative ${closing ? 'closing' : ''}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-semibold text-pulse-900 dark:text-pulse-400">
                {method.title}
              </h3>
              <button
                type="button"
                onClick={handleClose}
                aria-label="Kapat"
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-700 dark:text-gray-300">{method.summary}</p>

            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1.5">
                Nasıl hesaplanır?
              </p>
              <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
                {method.steps.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-pulse-900 dark:text-pulse-400 shrink-0">•</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>

            {method.assumption && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                <p className="text-xs text-amber-900 dark:text-amber-200">
                  <span className="font-medium">Not:</span> {method.assumption}
                </p>
              </div>
            )}

            {detail && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2">
                <p className="text-xs text-gray-700 dark:text-gray-300">{detail}</p>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
