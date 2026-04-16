'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, X, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

type ReasonCategory = 'not_using' | 'privacy_concern' | 'switched_provider' | 'dissatisfied' | 'other'

const REASON_OPTIONS: Array<{ value: ReasonCategory; label: string; subtitle: string }> = [
  { value: 'not_using', label: 'Artık kullanmıyorum', subtitle: 'Hizmet almayacağım, hesabımın kalmasına gerek yok' },
  { value: 'privacy_concern', label: 'Gizlilik endişem var', subtitle: 'Verilerimin silinmesini tercih ediyorum' },
  { value: 'switched_provider', label: 'Başka bir yere geçtim', subtitle: 'Artık farklı bir hizmet sağlayıcı kullanıyorum' },
  { value: 'dissatisfied', label: 'Memnun değilim', subtitle: 'Deneyimim olumsuz oldu' },
  { value: 'other', label: 'Diğer', subtitle: 'Farklı bir sebebim var' },
]

interface DataDeletionModalProps {
  open: boolean
  onClose: () => void
  onSubmitted?: () => void
}

export function DataDeletionModal({ open, onClose, onSubmitted }: DataDeletionModalProps) {
  const [step, setStep] = useState(1)
  const [reasonCategory, setReasonCategory] = useState<ReasonCategory | null>(null)
  const [reason, setReason] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setStep(1)
    setReasonCategory(null)
    setReason('')
    setConfirmation('')
    setError(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit() {
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/data-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reasonCategory,
          reason: reason.trim() || null,
          confirmation,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Talep oluşturulamadı')
        setSubmitting(false)
        return
      }
      onSubmitted?.()
      onClose()
    } catch (e: any) {
      setError('Bağlantı hatası')
    } finally {
      setSubmitting(false)
    }
  }

  const canGoStep2 = reasonCategory !== null
  const canSubmit = confirmation === 'VERİLERİMİ SİL' && !submitting

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4 modal-overlay"
      onClick={onClose}
    >
      <div
        className="relative bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                onClick={() => setStep(step - 1)}
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                aria-label="Geri"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            <div>
              <h3 className="text-lg font-serif font-semibold text-gray-900 dark:text-gray-100">Hesap Silme</h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">Adım {step}/3</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Kapat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {step === 1 && (
            <div className="space-y-4">
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                      Bu işlem 30 gün sonra verilerinizi kalıcı olarak siler.
                    </p>
                    <ul className="mt-2 text-xs text-amber-800/80 dark:text-amber-200/80 space-y-1 list-disc pl-4">
                      <li>Profil, randevu ve yorum geçmişin silinir</li>
                      <li>Yasal zorunluluk gereği fatura ve sağlık kayıtları saklanabilir</li>
                      <li>30 gün içinde istediğin zaman talebini iptal edebilirsin</li>
                    </ul>
                  </div>
                </div>
              </div>

              <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Ayrılma sebebini seçer misin?</p>
              <div className="space-y-2">
                {REASON_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setReasonCategory(opt.value)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all',
                      reasonCategory === opt.value
                        ? 'border-pulse-900 dark:border-pulse-300 bg-pulse-900/5 dark:bg-pulse-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    )}
                  >
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{opt.label}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{opt.subtitle}</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Daha iyi olmamız için kısa bir açıklama yazmak ister misin? (opsiyonel)
              </p>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={2000}
                rows={5}
                placeholder="Düşüncelerini buraya yazabilirsin..."
                className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900 resize-none"
              />
              <p className="text-[11px] text-gray-400 dark:text-gray-500 text-right">{reason.length}/2000</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-xl p-4">
                <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                  Son adım — onayın
                </p>
                <p className="text-xs text-red-800/80 dark:text-red-200/80 mt-1">
                  Devam etmek için aşağıya <strong className="font-mono">VERİLERİMİ SİL</strong> yaz.
                </p>
              </div>

              <input
                type="text"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="VERİLERİMİ SİL"
                autoComplete="off"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500"
              />

              {error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
                  {error}
                </div>
              )}
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
          {step < 3 ? (
            <button
              onClick={() => setStep(step + 1)}
              disabled={step === 1 && !canGoStep2}
              className="px-4 py-2 rounded-lg bg-gray-900 dark:bg-gray-100 hover:bg-gray-800 dark:hover:bg-white text-white dark:text-gray-900 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Devam Et
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Silme Talebi Oluştur
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
