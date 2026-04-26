'use client'

import { useState, useEffect, useCallback } from 'react'
import { Wallet, X, CreditCard, Banknote, ArrowRightLeft, Loader2, CheckCircle, Calendar, Clock } from 'lucide-react'
import { cn, formatCurrency, formatTime } from '@/lib/utils'
import { Portal } from '@/components/ui/portal'
import type { PaymentMethod } from '@/types'

interface AppointmentSummary {
  id: string
  customer_id: string | null
  appointment_date: string
  start_time: string
  customers: { name: string; phone: string | null } | null
  services: { name: string; price: number } | null
  staff_members: { name: string } | null
}

interface Props {
  open: boolean
  onClose: () => void
  /** Tahsilat başarıyla kaydedildiğinde tetiklenir (refetch için). */
  onCreated?: () => void
  appointment: AppointmentSummary
  /** İşlemi yapan personel (POS audit/raporlama için). */
  staffId: string | null
}

const METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: typeof Banknote }[] = [
  { value: 'cash',     label: 'Nakit',  icon: Banknote },
  { value: 'card',     label: 'Kart',   icon: CreditCard },
  { value: 'transfer', label: 'Havale', icon: ArrowRightLeft },
]

/**
 * Randevu panelinden hızlı tahsilat almak için modal.
 * Kasa/POS sayfasına gitmeden `/api/pos` üzerinden işlem yaratır:
 *   - pos_transactions kaydı (appointment_id ile bağlı)
 *   - tam ödenmişse otomatik invoices kaydı
 *   - paid_amount = total → randevu "tahsilat yapılmış" sayılır
 */
export function QuickPaymentModal({ open, onClose, onCreated, appointment, staffId }: Props) {
  const defaultPrice = appointment.services?.price ?? 0
  const [amount, setAmount] = useState<string>(String(defaultPrice))
  const [method, setMethod] = useState<PaymentMethod>('cash')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [done, setDone] = useState(false)

  const handleClose = useCallback(() => {
    if (saving) return
    setClosing(true)
  }, [saving])

  const onAnimEnd = () => {
    if (closing) {
      setClosing(false)
      onClose()
    }
  }

  // Modal açıldığında state'i sıfırla
  useEffect(() => {
    if (!open) return
    setAmount(String(defaultPrice))
    setMethod('cash')
    setNotes('')
    setDone(false)
  }, [open, defaultPrice])

  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open, handleClose])

  if (!open) return null

  const numericAmount = parseFloat(amount.replace(',', '.')) || 0
  const canSubmit = numericAmount > 0 && !!appointment.services && !saving

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    try {
      const res = await fetch('/api/pos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_id: appointment.customer_id,
          appointment_id: appointment.id,
          staff_id: staffId,
          items: [{
            id: `apt-${appointment.id}`,
            name: appointment.services!.name,
            type: 'service',
            quantity: 1,
            unit_price: numericAmount,
            total: numericAmount,
          }],
          payments: [{ method, amount: numericAmount }],
          transaction_type: 'sale',
          notes: notes.trim() || null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'error', title: 'Tahsilat başarısız', body: j.error || 'Sunucu hatası' },
        }))
        setSaving(false)
        return
      }
      setDone(true)
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'payment', title: 'Tahsilat alındı', body: formatCurrency(numericAmount) },
      }))
      onCreated?.()
      setTimeout(() => setClosing(true), 700)
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Bağlantı hatası' },
      }))
      setSaving(false)
    }
  }

  return (
    <Portal>
      <div
        className={cn(
          // Hafif karartma: slide-over'ın bg-black/50'si zaten var; üstüne hafif
          // bir katman ekleyerek modal'ı odakta tutuyoruz (toplam ~65%, eski
          // çift modal-overlay'den (~75%) belirgin daha açık).
          'fixed inset-0 z-[115] flex items-end sm:items-center justify-center p-0 sm:p-4 modal-overlay !bg-black/30 dark:!bg-black/40',
          closing && 'closing'
        )}
        onClick={handleClose}
        onAnimationEnd={onAnimEnd}
      >
        <div
          className="modal-content w-full sm:max-w-md bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-pulse-50 dark:bg-pulse-900/20 flex items-center justify-center">
                <Wallet className="h-4 w-4 text-pulse-900 dark:text-pulse-300" />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Hızlı Tahsilat</p>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-tight">
                  {appointment.customers?.name || 'Müşterisiz randevu'}
                </h3>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={saving}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              aria-label="Kapat"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {done ? (
            <div className="flex flex-col items-center justify-center py-10 gap-2">
              <div className="h-12 w-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Tahsilat alındı</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Fatura otomatik oluşturuldu</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {/* Randevu özeti */}
              <div className="rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 px-3 py-2.5 space-y-1">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {appointment.services?.name || 'Hizmet bilgisi yok'}
                </p>
                <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 flex-wrap">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(appointment.appointment_date + 'T00:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(appointment.start_time)}
                  </span>
                  {appointment.staff_members?.name && (
                    <span className="truncate">· {appointment.staff_members.name}</span>
                  )}
                </div>
              </div>

              {/* Tutar */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Tutar
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">₺</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:border-pulse-900 focus:ring-1 focus:ring-pulse-900 outline-none"
                    placeholder="0"
                  />
                </div>
                {defaultPrice > 0 && numericAmount !== defaultPrice && (
                  <button
                    type="button"
                    onClick={() => setAmount(String(defaultPrice))}
                    className="text-[11px] text-pulse-900 dark:text-pulse-400 hover:underline"
                  >
                    Hizmet fiyatına döndür ({formatCurrency(defaultPrice)})
                  </button>
                )}
              </div>

              {/* Ödeme yöntemi */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Ödeme Yöntemi
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {METHOD_OPTIONS.map((opt) => {
                    const Icon = opt.icon
                    const active = method === opt.value
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setMethod(opt.value)}
                        className={cn(
                          'flex flex-col items-center justify-center gap-1 py-3 rounded-xl border transition-colors',
                          active
                            ? 'border-pulse-900 bg-pulse-900/5 text-pulse-900 dark:border-pulse-400 dark:bg-pulse-900/20 dark:text-pulse-300'
                            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                        <span className="text-xs font-medium">{opt.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Not */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Not <span className="text-gray-400 font-normal normal-case">(opsiyonel)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={300}
                  placeholder="Tahsilat hakkında not"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 text-sm focus:border-pulse-900 focus:ring-1 focus:ring-pulse-900 outline-none resize-none"
                />
              </div>

              {/* Footer */}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={saving}
                  className="btn-secondary flex-1 disabled:opacity-50"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Kaydediliyor
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      {formatCurrency(numericAmount)} Tahsil Et
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </Portal>
  )
}
