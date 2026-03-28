'use client'

import { useState, useCallback, useRef } from 'react'
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
  const [closing, setClosing] = useState(false)
  const confirmedRef = useRef(false)

  const handleClose = useCallback(() => {
    confirmedRef.current = false
    setClosing(true)
  }, [])

  const handleAnimationEnd = useCallback((e: React.AnimationEvent) => {
    // Only fire on the overlay itself, not bubbled events from inner modal-content
    if (!closing || e.target !== e.currentTarget) return
    setClosing(false)
    if (confirmedRef.current) {
      confirmedRef.current = false
      onConfirm()
    } else {
      onClose()
    }
  }, [closing, onConfirm, onClose])

  const handleConfirm = useCallback(() => {
    confirmedRef.current = true
    setClosing(true)
  }, [])

  if (!open) return null

  return (
    <div
      className={`fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 modal-overlay ${closing ? 'closing' : ''}`}
      onClick={handleClose}
      onAnimationEnd={handleAnimationEnd}
    >
      <div
        className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6 modal-content ${closing ? 'closing' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
            variant === 'danger' ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'
          }`}>
            {variant === 'danger' ? (
              <Trash2 className="h-5 w-5 text-red-600 dark:text-red-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{message}</p>
          </div>
          <button onClick={handleClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 -mt-1">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl border border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`flex-1 px-4 py-2.5 text-sm font-medium rounded-xl text-white transition-colors ${
              variant === 'danger'
                ? 'bg-red-500 hover:bg-red-600'
                : 'bg-amber-500 hover:bg-amber-600'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
