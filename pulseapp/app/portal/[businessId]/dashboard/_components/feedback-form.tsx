'use client'

import { useState } from 'react'
import { Loader2, Lightbulb, AlertTriangle, Heart, HelpCircle, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeedbackType = 'suggestion' | 'complaint' | 'praise' | 'question'

const TYPE_OPTIONS: Array<{ value: FeedbackType; label: string; icon: typeof Lightbulb; color: string }> = [
  { value: 'suggestion', label: 'Öneri', icon: Lightbulb, color: 'from-amber-500 to-orange-500' },
  { value: 'complaint', label: 'Şikayet', icon: AlertTriangle, color: 'from-red-500 to-rose-500' },
  { value: 'praise', label: 'Teşekkür', icon: Heart, color: 'from-pink-500 to-rose-500' },
  { value: 'question', label: 'Soru', icon: HelpCircle, color: 'from-blue-500 to-indigo-500' },
]

interface FeedbackFormProps {
  onSubmitted?: () => void
}

export function FeedbackForm({ onSubmitted }: FeedbackFormProps) {
  const [type, setType] = useState<FeedbackType>('suggestion')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (message.trim().length < 5) {
      setError('Mesaj en az 5 karakter olmalı')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim() || null,
          message: message.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Gönderilemedi')
        setSubmitting(false)
        return
      }
      setSuccess(true)
      setSubject('')
      setMessage('')
      setType('suggestion')
      onSubmitted?.()
      setTimeout(() => setSuccess(false), 3000)
    } catch (e: any) {
      setError('Bağlantı hatası — tekrar deneyin')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-5">
      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
          Ne tür bir geri bildirim?
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TYPE_OPTIONS.map((opt) => {
            const Icon = opt.icon
            const active = type === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setType(opt.value)}
                className={cn(
                  'flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all',
                  active
                    ? 'border-pulse-900 dark:border-pulse-300 bg-pulse-900/5 dark:bg-pulse-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-900'
                )}
              >
                <div className={cn(
                  'h-8 w-8 rounded-lg flex items-center justify-center',
                  active
                    ? `bg-gradient-to-br ${opt.color} text-white shadow-md`
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <span className={cn(
                  'text-xs font-medium',
                  active ? 'text-pulse-900 dark:text-pulse-300' : 'text-gray-600 dark:text-gray-400'
                )}>
                  {opt.label}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
          Konu (opsiyonel)
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          placeholder="Örn: Randevu saatleri hakkında"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">
          Mesajın
        </label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={4000}
          rows={5}
          placeholder="Düşüncelerini bizimle paylaş..."
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-pulse-900/30 focus:border-pulse-900 resize-none"
        />
        <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 text-right">
          {message.length}/4000
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3 text-sm text-emerald-700 dark:text-emerald-300">
          Geri bildirimin alındı — teşekkürler! En kısa sürede inceleyeceğiz.
        </div>
      )}

      <button
        type="submit"
        disabled={submitting || message.trim().length < 5}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-pulse-900 hover:bg-pulse-800 text-white text-sm font-medium transition-colors disabled:opacity-50"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Gönder
      </button>
    </form>
  )
}
