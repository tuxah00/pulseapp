'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Loader2, MessageSquare, ThumbsUp, AlertTriangle, HelpCircle, Lightbulb, CheckCircle2, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

type FeedbackType = 'suggestion' | 'complaint' | 'praise' | 'question'

interface FeedbackEntry {
  id: string
  type: FeedbackType
  subject: string | null
  message: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  response: string | null
  responded_at: string | null
  created_at: string
}

const TYPE_OPTIONS: { value: FeedbackType; label: string; description: string; icon: typeof MessageSquare; accent: string }[] = [
  { value: 'praise', label: 'Teşekkür', description: 'Memnuniyetinizi paylaşın', icon: ThumbsUp, accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { value: 'suggestion', label: 'Öneri', description: 'İyileştirme fikriniz', icon: Lightbulb, accent: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
  { value: 'complaint', label: 'Şikayet', description: 'Bir sorun bildirin', icon: AlertTriangle, accent: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  { value: 'question', label: 'Soru', description: 'Bilgi almak istiyorsunuz', icon: HelpCircle, accent: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
]

const TYPE_LABELS: Record<FeedbackType, string> = {
  suggestion: 'Öneri', complaint: 'Şikayet', praise: 'Teşekkür', question: 'Soru',
}

const STATUS_LABELS: Record<FeedbackEntry['status'], string> = {
  open: 'Açık',
  in_progress: 'İnceleniyor',
  resolved: 'Yanıtlandı',
  closed: 'Kapatıldı',
}

const STATUS_COLORS: Record<FeedbackEntry['status'], string> = {
  open: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  closed: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export default function PortalFeedbackPage() {
  useParams() // ensure dynamic
  const [type, setType] = useState<FeedbackType>('suggestion')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [entries, setEntries] = useState<FeedbackEntry[]>([])
  const [loadingEntries, setLoadingEntries] = useState(true)

  const fetchEntries = useCallback(async () => {
    setLoadingEntries(true)
    try {
      const res = await fetch('/api/portal/feedback')
      if (res.ok) {
        const data = await res.json()
        setEntries(data.feedback || [])
      }
    } finally {
      setLoadingEntries(false)
    }
  }, [])

  useEffect(() => { fetchEntries() }, [fetchEntries])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (message.trim().length < 5) {
      setError('Mesajınız en az 5 karakter olmalı')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/portal/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          subject: subject.trim() || undefined,
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Geri bildirim kaydedilemedi')
        return
      }
      setSuccess(true)
      setSubject('')
      setMessage('')
      fetchEntries()
      setTimeout(() => setSuccess(false), 4000)
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Geri Bildirim</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Görüş, öneri, şikayet veya teşekkürünüzü işletmeye iletin.
        </p>
      </header>

      {success && (
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 px-4 py-3 flex items-start gap-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-300 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">Teşekkürler!</p>
            <p className="text-xs text-emerald-800/80 dark:text-emerald-200/80 mt-0.5">
              Geri bildiriminiz personele iletildi.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Tür</label>
          <div className="grid grid-cols-2 gap-2">
            {TYPE_OPTIONS.map(opt => {
              const Icon = opt.icon
              const active = type === opt.value
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={cn(
                    'flex items-center gap-2 p-2.5 rounded-xl border text-left transition',
                    active
                      ? 'border-pulse-500 dark:border-pulse-400 bg-pulse-50 dark:bg-pulse-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', opt.accent)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{opt.label}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{opt.description}</p>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Konu (opsiyonel)</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            maxLength={100}
            className="w-full input"
            placeholder="Kısa bir başlık"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mesajınız</label>
          <textarea
            rows={5}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            maxLength={1000}
            className="w-full input"
            placeholder="Görüşlerinizi paylaşın..."
            required
          />
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 text-right">{message.length}/1000</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-3 py-2 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Geri Bildirim Gönder
        </button>
      </form>

      {/* Geçmiş geri bildirimler */}
      <section>
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Önceki Geri Bildirimleriniz</h2>
        {loadingEntries ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : entries.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 text-sm text-gray-500 dark:text-gray-400 text-center">
            Henüz geri bildiriminiz yok.
          </div>
        ) : (
          <div className="space-y-2">
            {entries.map(e => (
              <div key={e.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{TYPE_LABELS[e.type]}</span>
                    {e.subject && <span className="text-xs text-gray-500 dark:text-gray-400">— {e.subject}</span>}
                  </div>
                  <span className={cn('text-[11px] font-medium px-2 py-0.5 rounded-full', STATUS_COLORS[e.status])}>
                    {STATUS_LABELS[e.status]}
                  </span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1.5 whitespace-pre-wrap">{e.message}</p>
                <div className="flex items-center gap-1.5 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                  <Clock className="w-3 h-3" />
                  {new Date(e.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
                {e.response && (
                  <div className="mt-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 p-3">
                    <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400 mb-1">İşletme yanıtı:</p>
                    <p className="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-wrap">{e.response}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
