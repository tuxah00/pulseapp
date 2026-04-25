'use client'

import { useEffect, useState } from 'react'
import { Copy, Check, Share2, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ReferralData {
  code: string
  url: string
  stats: {
    totalReferrals: number
    converted: number
  }
}

/**
 * Müşterinin tavsiye linkini gösterir + paylaşma kısayolları.
 *
 * - Kopyala butonu (clipboard API)
 * - WhatsApp share link (mobile + desktop)
 * - Toplam davet ve dönüşüm sayacı
 *
 * Endpoint ilk çağrıda kod üretir (customers.referral_code).
 */
export default function ReferralCard() {
  const [data, setData] = useState<ReferralData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/portal/referral-link')
      .then(async (r) => {
        const json = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(json?.error || 'Hata')
        return json as ReferralData
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Hata'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCopy() {
    if (!data) return
    try {
      await navigator.clipboard.writeText(data.url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback: input'a yaz, manuel kopyalat
      const textarea = document.createElement('textarea')
      textarea.value = data.url
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleWhatsapp() {
    if (!data) return
    const message = `Merhaba, sana harika bir salon önereceğim. Bu linkten randevu al: ${data.url}`
    const wa = `https://wa.me/?text=${encodeURIComponent(message)}`
    window.open(wa, '_blank', 'noopener,noreferrer')
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-3">
        <Loader2 className="h-4 w-4 animate-spin" />
        Tavsiye linkin hazırlanıyor...
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-700 dark:text-red-300">
        {error || 'Tavsiye linki yüklenemedi'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Aşağıdaki kişisel linkini paylaş. Arkadaşların bu link üzerinden randevu aldığında
        senin tarafından önerildiği kayıtlara işlenir.
      </p>

      <div className="flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 px-3 py-2.5">
        <code className="flex-1 text-sm font-mono text-gray-800 dark:text-gray-200 truncate">
          {data.url}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className={cn(
            'inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex-shrink-0',
            copied
              ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-pulse-900 hover:bg-pulse-800 text-white'
          )}
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5" /> Kopyalandı</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Kopyala</>
          )}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleWhatsapp}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
        >
          <Share2 className="h-3.5 w-3.5" />
          WhatsApp ile Paylaş
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 pt-2">
        <div className="rounded-xl bg-pulse-50 dark:bg-pulse-900/20 border border-pulse-100 dark:border-pulse-900/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-pulse-700 dark:text-pulse-300 font-semibold">Davet Edilen</p>
          <p className="text-2xl font-bold text-pulse-900 dark:text-pulse-300 tabular-nums mt-0.5">
            {data.stats.totalReferrals}
          </p>
        </div>
        <div className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40 px-3 py-2.5">
          <p className="text-[11px] uppercase tracking-wide text-emerald-700 dark:text-emerald-300 font-semibold">Randevu Aldı</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-300 tabular-nums mt-0.5">
            {data.stats.converted}
          </p>
        </div>
      </div>
    </div>
  )
}
