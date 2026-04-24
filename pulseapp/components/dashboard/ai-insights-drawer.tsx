'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, Lightbulb, TrendingDown, Target, Zap, ChevronRight, CheckCircle, XCircle, Loader2, AlertTriangle, Info } from 'lucide-react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { cn } from '@/lib/utils'
import { useRouter } from 'next/navigation'

interface SuggestedAction {
  tool_name: string
  args: Record<string, unknown>
  label: string
  href?: string
}

interface AIInsight {
  id: string
  type: 'opportunity' | 'risk' | 'suggestion' | 'automation_proposal'
  title: string
  body: string
  severity: 'info' | 'normal' | 'high' | 'critical'
  status: 'new' | 'viewed' | 'dismissed' | 'acted'
  source_event_type: string
  suggested_action?: SuggestedAction
  created_at: string
  expires_at?: string
}

interface AIInsightsDrawerProps {
  open: boolean
  onClose: () => void
}

const TYPE_CONFIG = {
  opportunity: {
    icon: Target,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/40',
    label: 'Fırsat',
  },
  risk: {
    icon: TrendingDown,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800/40',
    label: 'Risk',
  },
  suggestion: {
    icon: Lightbulb,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/40',
    label: 'Öneri',
  },
  automation_proposal: {
    icon: Zap,
    color: 'text-purple-600 dark:text-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-900/20',
    border: 'border-purple-200 dark:border-purple-800/40',
    label: 'Otomasyon',
  },
}

const SEVERITY_CONFIG = {
  info: { icon: Info, color: 'text-blue-500' },
  normal: { icon: Info, color: 'text-gray-400' },
  high: { icon: AlertTriangle, color: 'text-amber-500' },
  critical: { icon: AlertTriangle, color: 'text-red-500' },
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const hours = Math.floor(diff / (60 * 60 * 1000))
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days} gün önce`
  if (hours > 0) return `${hours} saat önce`
  return 'Az önce'
}

function InsightCard({
  insight,
  onDismiss,
  onAct,
}: {
  insight: AIInsight
  onDismiss: (id: string) => void
  onAct: (id: string, action?: SuggestedAction) => void
}) {
  const [acting, setActing] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const cfg = TYPE_CONFIG[insight.type]
  const TypeIcon = cfg.icon
  const sev = SEVERITY_CONFIG[insight.severity]
  const SevIcon = sev.icon

  if (dismissed) return null

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-all duration-200',
      cfg.bg, cfg.border,
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0 bg-white dark:bg-gray-900/50', cfg.border, 'border')}>
          <TypeIcon className={cn('h-4 w-4', cfg.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={cn('text-[10px] font-semibold uppercase tracking-wider', cfg.color)}>
              {cfg.label}
            </span>
            {insight.severity !== 'normal' && insight.severity !== 'info' && (
              <SevIcon className={cn('h-3 w-3', sev.color)} />
            )}
          </div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">
            {insight.title}
          </p>
        </div>
        <button
          onClick={() => {
            setDismissed(true)
            onDismiss(insight.id)
          }}
          className="flex-shrink-0 text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 transition-colors"
          title="Kapat"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Body */}
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400 leading-relaxed pl-11">
        {insight.body}
      </p>

      {/* Footer */}
      <div className="mt-3 flex items-center gap-2 pl-11">
        {insight.suggested_action && (
          <button
            onClick={async () => {
              setActing(true)
              await onAct(insight.id, insight.suggested_action)
              setActing(false)
            }}
            disabled={acting}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all',
              'bg-white dark:bg-gray-900/70 border shadow-sm',
              cfg.border,
              cfg.color,
              'hover:opacity-80 disabled:opacity-50',
            )}
          >
            {acting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            {insight.suggested_action.label}
          </button>
        )}
        <span className="text-[11px] text-gray-400 dark:text-gray-600 ml-auto">
          {timeAgo(insight.created_at)}
        </span>
      </div>
    </div>
  )
}

export function AIInsightsDrawer({ open, onClose }: AIInsightsDrawerProps) {
  const { businessId } = useBusinessContext()
  const router = useRouter()
  const [insights, setInsights] = useState<AIInsight[]>([])
  const [loading, setLoading] = useState(false)
  const [closing, setClosing] = useState(false)

  const fetchInsights = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/ai/insights?businessId=${businessId}`)
      if (res.ok) {
        const data = await res.json()
        setInsights(data.insights ?? [])
        // Okundu sayacını sıfırla
        window.dispatchEvent(new CustomEvent('pulse-insights-read'))
      }
    } finally {
      setLoading(false)
    }
  }, [businessId])

  useEffect(() => {
    if (open) fetchInsights()
  }, [open, fetchInsights])

  // ESC ile kapat
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [open])

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      setClosing(false)
      onClose()
    }, 200)
  }

  const handleDismiss = async (id: string) => {
    await fetch(`/api/ai/insights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'dismissed' }),
    })
    setInsights(prev => prev.filter(i => i.id !== id))
  }

  const handleAct = async (id: string, action?: SuggestedAction) => {
    await fetch(`/api/ai/insights/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acted' }),
    })
    setInsights(prev => prev.filter(i => i.id !== id))
    if (action?.href) {
      handleClose()
      router.push(action.href)
    }
  }

  if (!open && !closing) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'modal-overlay z-[110] backdrop-blur-sm',
          closing && 'closing',
        )}
        onClick={handleClose}
      />

      {/* Panel */}
      <div
        className={cn(
          'slide-panel !max-w-sm',
          'bg-white dark:bg-gray-950 border-l border-gray-200 dark:border-gray-800',
          'flex flex-col shadow-2xl',
          closing && 'closing',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4.5 w-4.5 text-amber-500" />
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">AI Önerileri</span>
            {insights.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 px-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400">
                {insights.length}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-gray-400 dark:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : insights.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3">
                <CheckCircle className="h-6 w-6 text-gray-400 dark:text-gray-600" />
              </div>
              <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Yeni öneri yok</p>
              <p className="text-xs text-gray-400 dark:text-gray-600 mt-1">Asistan işletmenizi sürekli izliyor</p>
            </div>
          ) : (
            insights.map(insight => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onDismiss={handleDismiss}
                onAct={handleAct}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <p className="text-[11px] text-gray-400 dark:text-gray-600 text-center">
            Asistan işletmenizi sürekli analiz ederek fırsat ve riskleri tespit eder
          </p>
        </div>
      </div>
    </>
  )
}
