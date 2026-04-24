'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, Cake, Star, Heart, Loader2, CheckCircle2, AlertCircle, Clock, Play } from 'lucide-react'

type JobType = 'reminders' | 'birthday' | 'review_requests' | 'winback'

interface JobMeta {
  key: JobType
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  accent: string // tailwind bg/text accent
}

interface RunRecord {
  id: string
  job_type: JobType
  triggered_by: 'cron' | 'manual'
  result: Record<string, number> | null
  duration_ms: number | null
  error: string | null
  created_at: string
}

const JOBS: JobMeta[] = [
  {
    key: 'reminders',
    title: 'Randevu Hatırlatmaları',
    description: 'Yarınki randevular için 24 saat hatırlatması, bugünkü randevular için 2 saat hatırlatması.',
    icon: Bell,
    accent: 'from-blue-500/15 to-blue-500/5 text-blue-700 dark:text-blue-300',
  },
  {
    key: 'birthday',
    title: 'Doğum Günü Kutlamaları',
    description: 'Bugün doğan müşterilere kutlama mesajı gönderir (her müşteriye günde bir kez).',
    icon: Cake,
    accent: 'from-pink-500/15 to-pink-500/5 text-pink-700 dark:text-pink-300',
  },
  {
    key: 'review_requests',
    title: 'Yorum İstekleri',
    description: 'Tamamlanmış randevular için müşterilere yorum bırakma daveti gönderir.',
    icon: Star,
    accent: 'from-amber-500/15 to-amber-500/5 text-amber-700 dark:text-amber-300',
  },
  {
    key: 'winback',
    title: 'Müşteri Segmentleri (Winback)',
    description: 'Uzun süredir gelmeyen müşterileri "Risk" / "Kayıp" olarak işaretler.',
    icon: Heart,
    accent: 'from-rose-500/15 to-rose-500/5 text-rose-700 dark:text-rose-300',
  },
]

function formatRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diffMs / 60000)
  if (min < 1) return 'az önce'
  if (min < 60) return `${min} dk önce`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} saat önce`
  const day = Math.floor(hr / 24)
  return `${day} gün önce`
}

function summarizeResult(jobType: JobType, result: Record<string, number> | null): string {
  if (!result) return '-'
  switch (jobType) {
    case 'reminders': {
      const total = (result.sent24h || 0) + (result.sent2h || 0)
      return `${total} bildirim · ${result.confirmations || 0} onay isteği · ${result.errors || 0} hata`
    }
    case 'birthday':
      return `${result.sent || 0} kutlama · ${result.skipped || 0} atlandı`
    case 'review_requests':
      return `${result.sent || 0} yorum daveti gönderildi`
    case 'winback':
      return `${result.segmentsUpdated || 0} müşteri segmenti güncellendi`
  }
}

export default function AutomationsPage() {
  const [runs, setRuns] = useState<RunRecord[]>([])
  const [loadingJob, setLoadingJob] = useState<JobType | null>(null)
  const [lastResult, setLastResult] = useState<Record<JobType, RunRecord | null>>({
    reminders: null, birthday: null, review_requests: null, winback: null,
  })

  const fetchRuns = useCallback(async () => {
    const res = await fetch('/api/automations/run', { method: 'GET' })
    if (!res.ok) return
    const data = await res.json()
    setRuns(data.runs || [])
  }, [])

  useEffect(() => { fetchRuns() }, [fetchRuns])

  const lookupRun = useCallback((job: JobType): RunRecord | null => {
    return lastResult[job] || runs.find(r => r.job_type === job) || null
  }, [runs, lastResult])

  const handleRun = async (job: JobType) => {
    setLoadingJob(job)
    try {
      const res = await fetch('/api/automations/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobType: job }),
      })
      const data = await res.json()
      const newRecord: RunRecord = {
        id: 'temp-' + Date.now(),
        job_type: job,
        triggered_by: 'manual',
        result: data.result || null,
        duration_ms: data.durationMs ?? null,
        error: data.error || (data.success === false ? 'Bilinmeyen hata' : null),
        created_at: new Date().toISOString(),
      }
      setLastResult(prev => ({ ...prev, [job]: newRecord }))
      const title = data.success ? 'Otomasyon çalıştırıldı' : 'Otomasyon hatası'
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: {
          type: data.success ? 'success' : 'error',
          title,
          body: data.error || summarizeResult(job, data.result),
        },
      }))
      fetchRuns()
    } catch (err) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Otomasyon başarısız', body: err instanceof Error ? err.message : String(err) },
      }))
    } finally {
      setLoadingJob(null)
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Otomasyonlar</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Pilot modunda otomasyonlar manuel tetiklenir. Mesajlar SMS yerine bildirim olarak personele iletilir.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {JOBS.map(job => {
          const Icon = job.icon
          const last = lookupRun(job.key)
          const loading = loadingJob === job.key
          return (
            <div
              key={job.key}
              className={`card bg-gradient-to-br ${job.accent} border border-gray-200 dark:border-gray-800 p-5 flex flex-col gap-3`}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/60 dark:bg-gray-900/40 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900 dark:text-gray-100">{job.title}</h2>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 leading-snug">{job.description}</p>
                </div>
              </div>

              {last && (
                <div className="text-xs text-gray-700 dark:text-gray-300 bg-white/50 dark:bg-gray-900/40 rounded-lg px-3 py-2 space-y-1">
                  <div className="flex items-center gap-1.5">
                    {last.error ? (
                      <AlertCircle className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    )}
                    <span className="font-medium">{summarizeResult(job.key, last.result)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelative(last.created_at)} · {last.triggered_by === 'manual' ? 'manuel' : 'cron'}</span>
                  </div>
                  {last.error && (
                    <div className="text-red-600 dark:text-red-400 text-xs">{last.error}</div>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => handleRun(job.key)}
                disabled={loading}
                className="btn-primary inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {loading ? 'Çalışıyor...' : 'Şimdi Çalıştır'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
