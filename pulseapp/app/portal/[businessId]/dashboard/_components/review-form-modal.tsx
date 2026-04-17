'use client'

import { useEffect, useState } from 'react'
import { Star, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface PendingAppointmentForReview {
  id: string
  appointment_date: string
  start_time: string
  services?: { id: string; name: string } | { id: string; name: string }[] | null
  staff_members?: { id: string; name: string } | { id: string; name: string }[] | null
}

function first<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null
  if (Array.isArray(v)) return v[0] || null
  return v
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

interface ReviewFormModalProps {
  open: boolean
  appointment?: PendingAppointmentForReview | null
  onClose: () => void
  onSubmitted?: () => void
}

export function ReviewFormModal({ open, appointment, onClose, onSubmitted }: ReviewFormModalProps) {
  const [rating, setRating] = useState(5)
  const [hoverRating, setHoverRating] = useState(0)
  const [comment, setComment] = useState('')
  const [isAnonymous, setIsAnonymous] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setRating(5)
    setHoverRating(0)
    setComment('')
    setIsAnonymous(true)
    setError(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const service = first(appointment?.services)
  const staff = first(appointment?.staff_members)

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating,
          comment: comment.trim() || null,
          appointmentId: appointment?.id || null,
          isAnonymous,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Yorum gönderilemedi')
        setSubmitting(false)
        return
      }
      onSubmitted?.()
      onClose()
    } catch (e: any) {
      setError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setSubmitting(false)
    }
  }

  const displayRating = hoverRating || rating

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/70 flex items-center justify-center p-4 modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yorum Yaz</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Deneyimini bizimle paylaş, geri bildirim bizim için çok değerli.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {appointment && (
            <div className="bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-pulse-900/20 dark:to-indigo-900/20 border border-pulse-100 dark:border-pulse-900/40 rounded-xl p-3">
              <p className="text-[11px] font-medium text-pulse-900 dark:text-pulse-300 uppercase tracking-wide">
                Randevu
              </p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                {service?.name || 'Hizmet'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatDate(appointment.appointment_date)} · {appointment.start_time?.slice(0, 5)}
                {staff?.name ? ` · ${staff.name}` : ''}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Puanın</p>
            <div className="flex items-center gap-1" onMouseLeave={() => setHoverRating(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  className="p-1 transition-transform hover:scale-110"
                  aria-label={`${n} yıldız`}
                >
                  <Star
                    className={cn(
                      'h-8 w-8 transition-colors',
                      n <= displayRating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-gray-300 dark:text-gray-600'
                    )}
                  />
                </button>
              ))}
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                {displayRating}/5
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
              Yorumun (opsiyonel)
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="Deneyimini birkaç cümleyle anlat..."
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900 resize-none"
            />
            <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-right">
              {comment.length}/2000
            </p>
          </div>

          <label className="flex items-start gap-3 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-pulse-900 focus:ring-pulse-900/30"
            />
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Anonim olarak yorum yap</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Anonim yorumlarda adınız işletme yorumları listesinde gösterilmez.
              </p>
            </div>
          </label>

          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || rating < 1}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Gönder
          </button>
        </div>
      </div>
    </div>
  )
}
