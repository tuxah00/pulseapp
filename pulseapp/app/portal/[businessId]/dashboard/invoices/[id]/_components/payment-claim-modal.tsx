'use client'

import { useEffect, useState } from 'react'
import { Loader2, X, Banknote } from 'lucide-react'

interface Props {
  open: boolean
  invoiceId: string
  defaultAmount: number
  onClose: () => void
  onSubmitted: () => void
}

const METHOD_OPTIONS = [
  { value: 'havale', label: 'Havale / EFT' },
  { value: 'nakit', label: 'Nakit (mağazada)' },
  { value: 'kart_terminali', label: 'Kart terminali' },
  { value: 'diger', label: 'Diğer' },
]

export default function PaymentClaimModal({ open, invoiceId, defaultAmount, onClose, onSubmitted }: Props) {
  const today = new Date().toISOString().slice(0, 10)
  const [paymentDate, setPaymentDate] = useState(today)
  const [method, setMethod] = useState('havale')
  const [amount, setAmount] = useState<number>(defaultAmount)
  const [ibanLast4, setIbanLast4] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { if (open) setAmount(defaultAmount) }, [open, defaultAmount])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  async function handleSubmit() {
    setError(null)
    if (!(amount > 0)) { setError('Geçerli bir tutar girin'); return }
    if (method === 'havale' && ibanLast4 && !/^\d{4}$/.test(ibanLast4)) {
      setError('IBAN son 4 hane sadece rakam olmalı'); return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/portal/invoices/${invoiceId}/payment-claim`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_date: paymentDate,
          payment_method: method,
          amount,
          iban_last4: method === 'havale' ? ibanLast4 || null : null,
          note: note || null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Bildirim gönderilemedi')
        return
      }
      onSubmitted()
      onClose()
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 modal-overlay bg-black/40">
      <div className="modal-content bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-5 sm:p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-green-700 dark:text-green-300" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Ödeme Bildirimi</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Personel onayladıktan sonra fatura ödendi olarak işaretlenir.</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ödeme Tarihi</label>
            <input
              type="date"
              value={paymentDate}
              max={today}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Ödeme Yöntemi</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="w-full input">
              {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Tutar (₺)</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full input"
            />
          </div>
          {method === 'havale' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">IBAN son 4 hane (opsiyonel)</label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={ibanLast4}
                onChange={(e) => setIbanLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="1234"
                className="w-full input"
              />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Açıklama (opsiyonel)</label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full input"
              placeholder="Örn: Saat 14:30'da gönderdim"
            />
          </div>

          {error && (
            <div className="text-sm text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800">
            Vazgeç
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm disabled:opacity-60"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Bildir
          </button>
        </div>
      </div>
    </div>
  )
}
