'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { CreditCard, X, Loader2 } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface PaymentIframeModalProps {
  invoiceId: string
  open: boolean
  onClose: () => void
  /** Ödeme akışı tamamlanınca tetiklenir (refetch). */
  onCompleted?: () => void
}

interface CheckoutResponse {
  iframeUrl: string
  amount: number
  merchantOid: string
}

/**
 * PayTR iframe ödeme modal'ı.
 *
 * Akış:
 *  1. POST /api/portal/invoices/[id]/checkout → iframeUrl + amount
 *  2. iframeUrl modal içinde embed edilir
 *  3. PayTR tarafı kullanıcıyı `merchant_ok_url` veya `merchant_fail_url` ile
 *     yine portala döndürür (?payment=success|failed query param'ı ile).
 *  4. Modal kapatılınca onCompleted çağrılır → fatura yeniden fetch edilir.
 */
export default function PaymentIframeModal({
  invoiceId,
  open,
  onClose,
  onCompleted,
}: PaymentIframeModalProps) {
  const [loading, setLoading] = useState(false)
  const [checkout, setCheckout] = useState<CheckoutResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = useCallback(() => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
      if (checkout) onCompleted?.()
    }, 200)
  }, [onClose, onCompleted, checkout])

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, handleClose])

  useEffect(() => {
    if (!open) {
      setCheckout(null)
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    fetch(`/api/portal/invoices/${invoiceId}/checkout`, {
      method: 'POST',
    })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(data?.error || 'Ödeme başlatılamadı')
        return data as CheckoutResponse
      })
      .then(setCheckout)
      .catch((e) => setError(e instanceof Error ? e.message : 'Hata'))
      .finally(() => setLoading(false))
  }, [open, invoiceId])

  if (!open) return null

  return createPortal(
    <div
      className={cn('modal-overlay fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4', closing && 'closing')}
      onClick={handleClose}
    >
      <div
        className={cn('modal-content card w-full max-w-2xl max-h-[90vh] flex flex-col', closing && 'closing')}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-pulse-50 dark:bg-pulse-900/30 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-pulse-900 dark:text-pulse-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
                Online Ödeme
              </h2>
              {checkout && (
                <p className="text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                  Tutar: {formatCurrency(checkout.amount)}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Kapat"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden">
          {loading ? (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center gap-3 text-gray-500 dark:text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin text-pulse-900 dark:text-pulse-300" />
              <p className="text-sm">Güvenli ödeme sayfası hazırlanıyor...</p>
            </div>
          ) : error ? (
            <div className="p-6">
              <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
                {error}
              </div>
            </div>
          ) : checkout ? (
            <iframe
              src={checkout.iframeUrl}
              className="w-full h-[600px] border-0"
              title="PayTR güvenli ödeme"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-top-navigation"
            />
          ) : null}
        </div>
      </div>
    </div>,
    document.body
  )
}
