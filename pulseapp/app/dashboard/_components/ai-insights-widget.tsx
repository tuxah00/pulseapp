'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Send, X, MessageSquare, Users, TrendingUp, Calendar } from 'lucide-react'
import type { CampaignSuggestion } from '@/app/api/ai/campaign-suggest/route'
import { cn } from '@/lib/utils'

const CAMPAIGN_TYPE_CONFIG: Record<string, { label: string; color: string }> = {
  winback: { label: 'Geri Kazanım', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
  upsell: { label: 'Üst Satış', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  loyalty: { label: 'Sadakat', color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  birthday: { label: 'Doğum Günü', color: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400' },
  seasonal: { label: 'Sezonsal', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

export default function AiInsightsWidget() {
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<CampaignSuggestion[] | null>(null)
  const [stats, setStats] = useState<{ totalCustomers: number; riskCount: number; upcomingBirthdays: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)

  async function loadSuggestions() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/ai/campaign-suggest', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Kampanya önerileri alınamadı')
      } else {
        setSuggestions(json.suggestions || [])
        setStats(json.stats)
      }
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setLoading(false)
    }
  }

  function copyMessage(msg: string, idx: number) {
    navigator.clipboard.writeText(msg).then(() => {
      setCopiedIdx(idx)
      setTimeout(() => setCopiedIdx(null), 2000)
    })
  }

  if (!suggestions && !loading) {
    return (
      <button
        onClick={loadSuggestions}
        className="card w-full text-left hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors border-dashed border-2"
      >
        <div className="flex items-center gap-3 py-2">
          <div className="h-9 w-9 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Kampanya Önerileri</p>
            <p className="text-xs text-gray-400">Müşteri segmentlerine göre hedefli mesajlar</p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-indigo-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">AI Kampanya Önerileri</p>
            {stats && <p className="text-xs text-gray-400">{stats.totalCustomers} müşteri analiz edildi</p>}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={loadSuggestions}
            disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-xs text-gray-400"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Yenile'}
          </button>
          <button onClick={() => setSuggestions(null)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
            <X className="h-3.5 w-3.5 text-gray-400" />
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-500" />
          Kampanya önerileri hazırlanıyor...
        </div>
      )}

      {error && !loading && (
        <p className="text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{error}</p>
      )}

      {stats && !loading && (
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{stats.totalCustomers}</p>
            <p className="text-xs text-gray-400 flex items-center justify-center gap-0.5"><Users className="h-3 w-3" /> Müşteri</p>
          </div>
          <div className={cn('text-center p-2 rounded-lg', stats.riskCount > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-gray-700/50')}>
            <p className={cn('text-lg font-bold', stats.riskCount > 0 ? 'text-amber-600' : 'text-gray-900 dark:text-gray-100')}>{stats.riskCount}</p>
            <p className="text-xs text-gray-400">Risk</p>
          </div>
          <div className={cn('text-center p-2 rounded-lg', stats.upcomingBirthdays > 0 ? 'bg-pink-50 dark:bg-pink-900/20' : 'bg-gray-50 dark:bg-gray-700/50')}>
            <p className={cn('text-lg font-bold', stats.upcomingBirthdays > 0 ? 'text-pink-600' : 'text-gray-900 dark:text-gray-100')}>{stats.upcomingBirthdays}</p>
            <p className="text-xs text-gray-400">Doğum günü</p>
          </div>
        </div>
      )}

      {suggestions && !loading && suggestions.length > 0 && (
        <div className="space-y-3">
          {suggestions.map((s, i) => {
            const typeCfg = CAMPAIGN_TYPE_CONFIG[s.campaignType] || CAMPAIGN_TYPE_CONFIG.seasonal
            return (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', typeCfg.color)}>
                        {typeCfg.label}
                      </span>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{s.segmentLabel}</span>
                      {s.customerCount > 0 && (
                        <span className="text-[10px] text-gray-400">{s.customerCount} kişi</span>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 mt-1">{s.subject}</p>
                  </div>
                </div>
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-2.5 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {s.message}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                    <Calendar className="h-3 w-3" /> {s.bestTime}
                  </span>
                  <button
                    onClick={() => copyMessage(s.message, i)}
                    className={cn(
                      'text-[10px] flex items-center gap-0.5 px-2 py-1 rounded-lg transition-colors',
                      copiedIdx === i
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                        : 'bg-indigo-50 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-400 hover:bg-indigo-100'
                    )}
                  >
                    {copiedIdx === i ? (
                      'Kopyalandı!'
                    ) : (
                      <><MessageSquare className="h-3 w-3" /> Mesajı Kopyala</>
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {suggestions && !loading && suggestions.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-3">Şu an için öneri bulunamadı.</p>
      )}
    </div>
  )
}
