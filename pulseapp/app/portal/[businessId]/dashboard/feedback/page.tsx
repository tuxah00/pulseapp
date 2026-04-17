'use client'

import { useEffect, useState } from 'react'
import { Inbox, Loader2, Lightbulb, AlertTriangle, Heart, HelpCircle, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FeedbackForm } from '../_components/feedback-form'
import { SectionHeader } from '../_components/section-header'

type FeedbackType = 'suggestion' | 'complaint' | 'praise' | 'question'
type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

interface FeedbackItem {
  id: string
  type: FeedbackType
  subject: string | null
  message: string
  status: FeedbackStatus
  response: string | null
  responded_at: string | null
  created_at: string
}

const TYPE_LABELS: Record<FeedbackType, string> = {
  suggestion: 'Öneri',
  complaint: 'Şikayet',
  praise: 'Teşekkür',
  question: 'Soru',
}

const TYPE_ICONS: Record<FeedbackType, typeof Lightbulb> = {
  suggestion: Lightbulb,
  complaint: AlertTriangle,
  praise: Heart,
  question: HelpCircle,
}

const TYPE_COLORS: Record<FeedbackType, string> = {
  suggestion: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  complaint: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  praise: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  question: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
}

const STATUS_LABELS: Record<FeedbackStatus, string> = {
  open: 'Açık',
  in_progress: 'İşlemde',
  resolved: 'Çözüldü',
  closed: 'Kapalı',
}

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  open: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  in_progress: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800',
  closed: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return iso
  }
}

export default function PortalFeedbackPage() {
  const [items, setItems] = useState<FeedbackItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    const res = await fetch('/api/portal/feedback')
    if (res.ok) {
      const data = await res.json()
      setItems(data.feedback || [])
    }
  }

  useEffect(() => {
    (async () => {
      await load()
      setLoading(false)
    })()
  }, [])

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Geri Bildirim</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Seni dinliyoruz — her öneri, şikayet ve teşekkür bizim için değerli.
        </p>
      </div>

      {/* Yeni Gönderi Formu */}
      <section>
        <SectionHeader
          title="Yeni Geri Bildirim"
          subtitle="Bir iki cümle bile olsa, okuyoruz."
          icon={Lightbulb}
        />
        <FeedbackForm onSubmitted={load} />
      </section>

      {/* Geçmiş Gönderiler */}
      <section>
        <SectionHeader
          title="Önceki Gönderilerim"
          subtitle={items.length > 0 ? `Toplam ${items.length} gönderi` : undefined}
          icon={Inbox}
        />

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-8 text-center">
            <Inbox className="h-10 w-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Henüz bir gönderimin yok.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Aklına ne gelirse yaz — yukarıdan birkaç cümleyle paylaşabilirsin.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => {
              const Icon = TYPE_ICONS[item.type]
              return (
                <div key={item.id} className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className={cn(
                        'h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0',
                        TYPE_COLORS[item.type]
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {TYPE_LABELS[item.type]}
                          </span>
                          <span className="text-gray-300 dark:text-gray-700">·</span>
                          <span className="text-[11px] text-gray-500 dark:text-gray-400">
                            {formatDate(item.created_at)}
                          </span>
                        </div>
                        {item.subject && (
                          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                            {item.subject}
                          </h3>
                        )}
                        <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap break-words">
                          {item.message}
                        </p>
                      </div>
                    </div>
                    <span className={cn(
                      'text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0',
                      STATUS_COLORS[item.status] || STATUS_COLORS.open
                    )}>
                      {STATUS_LABELS[item.status] || item.status}
                    </span>
                  </div>

                  {item.response && (
                    <div className="mt-4 bg-pulse-900/5 dark:bg-pulse-900/20 border-l-2 border-pulse-900 dark:border-pulse-300 rounded-r-lg p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-pulse-900 dark:text-pulse-300 uppercase tracking-wide">
                        <CheckCircle2 className="h-3 w-3" />
                        İşletmenin yanıtı
                        {item.responded_at && (
                          <span className="text-gray-500 dark:text-gray-400 font-normal normal-case">
                            · {formatDate(item.responded_at)}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-1 whitespace-pre-wrap">
                        {item.response}
                      </p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
