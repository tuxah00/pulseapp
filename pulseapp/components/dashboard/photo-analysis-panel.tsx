'use client'

import { useState } from 'react'
import { Loader2, Sparkles, X, ChevronDown, Camera, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  customerId?: string
  beforeUrl?: string
  afterUrl?: string
  photoUrl?: string
  protocolId?: string
  mode: 'single' | 'before_after'
  onClose?: () => void
}

export function PhotoAnalysisPanel({ customerId, beforeUrl, afterUrl, photoUrl, protocolId, mode, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)

  async function runAnalysis() {
    setLoading(true); setError(null); setAnalysis(null)

    try {
      let res: Response
      if (mode === 'before_after') {
        res = await fetch('/api/ai/before-after', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ beforeUrl, afterUrl, customerId, protocolId }),
        })
      } else {
        res = await fetch('/api/ai/photo-analysis', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoUrl, customerId, analysisType: 'single' }),
        })
      }
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Analiz yapılamadı')
      } else {
        setAnalysis(json.analysis)
      }
    } catch {
      setError('Bağlantı hatası')
    } finally {
      setLoading(false)
    }
  }

  const canRun = mode === 'before_after' ? !!(beforeUrl && afterUrl) : !!photoUrl

  return (
    <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 overflow-hidden">
      <div
        className="flex items-center justify-between px-4 py-3 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-indigo-500" />
          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400">
            {mode === 'before_after' ? 'AI Karşılaştırma Analizi' : 'AI Fotoğraf Analizi'}
          </span>
          {analysis && (
            <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">Tamamlandı</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {onClose && (
            <button onClick={(e) => { e.stopPropagation(); onClose() }} className="h-5 w-5 flex items-center justify-center text-gray-400 hover:text-gray-600">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown className={cn('h-4 w-4 text-gray-400 transition-transform', expanded && 'rotate-180')} />
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {!canRun && (
            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
              {mode === 'before_after'
                ? 'Karşılaştırma için hem öncesi hem sonrası fotoğraf gerekli.'
                : 'Analiz için bir fotoğraf seçin.'}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {analysis ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <Camera className="h-3.5 w-3.5" /> AI Analiz Raporu
              </div>
              <div className="rounded-lg bg-white dark:bg-gray-800 border border-indigo-100 dark:border-indigo-800 p-3 text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {analysis}
              </div>
              <button
                onClick={runAnalysis}
                disabled={loading || !canRun}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Yeniden Analiz Et
              </button>
            </div>
          ) : (
            <button
              onClick={runAnalysis}
              disabled={loading || !canRun}
              className={cn(
                'flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-lg text-sm font-medium transition-colors',
                canRun && !loading
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
              )}
            >
              {loading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Analiz ediliyor...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> AI ile Analiz Et</>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
