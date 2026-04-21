'use client'

import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, Trash2, X } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'warning'
}

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Onay',
  message,
  confirmText = 'Evet',
  cancelText = 'Vazgeç',
  variant = 'danger',
}: ConfirmDialogProps) {
  const confirmedRef = useRef(false)

  const handleClose = useCallback(() => {
    confirmedRef.current = false
    onClose()
  }, [onClose])

  const handleConfirm = useCallback(() => {
    confirmedRef.current = true
    onConfirm()
  }, [onConfirm])

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[120] bg-black/50 dark:bg-black/70 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Dialog */}
          <div className="fixed inset-0 z-[121] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              key="dialog"
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 12 }}
              transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              className="pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl
                         bg-white dark:bg-gray-900
                         border border-gray-200/80 dark:border-white/10
                         shadow-2xl shadow-black/20 dark:shadow-black/60"
              onClick={e => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-5">
                  {/* Icon */}
                  <div className={`flex-shrink-0 flex h-11 w-11 items-center justify-center rounded-xl ${
                    variant === 'danger'
                      ? 'bg-red-100 dark:bg-red-500/15'
                      : 'bg-amber-100 dark:bg-amber-500/15'
                  }`}>
                    {variant === 'danger' ? (
                      <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 leading-snug">
                      {title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                      {message}
                    </p>
                  </div>

                  <button
                    onClick={handleClose}
                    className="flex-shrink-0 rounded-lg p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300
                               hover:bg-gray-100 dark:hover:bg-white/10 transition-colors -mr-1 -mt-1"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700
                               px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300
                               hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    {cancelText}
                  </button>
                  <button
                    onClick={handleConfirm}
                    className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium text-white
                                transition-all duration-150 active:scale-[0.98] ${
                      variant === 'danger'
                        ? 'bg-red-500 hover:bg-red-600 shadow-sm shadow-red-500/20'
                        : 'bg-amber-500 hover:bg-amber-600 shadow-sm shadow-amber-500/20'
                    }`}
                  >
                    {confirmText}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
