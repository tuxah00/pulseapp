'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2, XCircle, Clock, Loader2, AlertTriangle,
  Inbox, Calendar, Bot, History, PlayCircle,
} from 'lucide-react'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { formatDateTime } from '@/lib/utils'
import { ACTION_TYPE_LABELS } from '@/lib/ai/assistant-tools'
import EmptyState from '@/components/ui/empty-state'

interface PendingAction {
  id: string
  action_type: string
  payload: Record<string, any>
  preview: string
  status: 'pending' | 'scheduled' | 'executed' | 'cancelled' | 'expired'
  scheduled_for: string | null
  created_at: string
  expires_at: string | null
  executed_at: string | null
  result: any
}

type Tab = 'open' | 'history'

function timeUntil(iso: string | null): string | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff < 0) return 'süresi doldu'
  const mins = Math.round(diff / 60000)
  if (mins < 60) return `${mins} dk kaldı`
  const hours = Math.round(mins / 60)
  if (hours < 48) return `${hours} saat kaldı`
  return `${Math.round(hours / 24)} gün kaldı`
}

export default function AiActionsPage() {
  const { permissions } = useBusinessContext()
  requirePermission(permissions, 'assistant_actions')
  const [tab, setTab] = useState<Tab>('open')
  const [actions, setActions] = useState<PendingAction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { confirm } = useConfirm()

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/actions?status=${tab}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Veri alınamadı (${res.status})`)
      }
      const json = await res.json()
      setActions(json.actions || [])
    } catch (err: any) {
      setError(err?.message || 'Hata oluştu')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => { load() }, [load])

  async function handleDecide(action: PendingAction, decision: 'confirm' | 'cancel') {
    const verbNoun = decision === 'confirm' ? 'onayla' : 'reddet'
    const ok = await confirm({
      title: decision === 'confirm' ? 'Öneriyi onayla' : 'Öneriyi reddet',
      message: `"${action.preview}" önerisini ${verbNoun}mek istediğinize emin misiniz?`,
      confirmText: decision === 'confirm' ? 'Onayla ve Çalıştır' : 'İptal Et',
      cancelText: 'Vazgeç',
      variant: decision === 'cancel' ? 'danger' : 'warning',
    })
    if (!ok) return

    setBusyId(action.id)
    try {
      const res = await fetch('/api/ai/assistant/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_id: action.id, decision }),
      })
      const json = await res.json()
      if (!res.ok || json?.ok === false) {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: { type: 'error', title: 'Hata', body: json?.message || json?.error || 'İşlem başarısız' },
        }))
      } else {
        window.dispatchEvent(new CustomEvent('pulse-toast', {
          detail: {
            type: 'system',
            title: decision === 'confirm' ? 'Uygulandı' : 'Reddedildi',
            body: json?.message || 'Tamamlandı',
          },
        }))
        // Açık listede anında kaldır (optimistic); geçmişte yeniden yükle
        if (tab === 'open') {
          setActions(prev => prev.filter(a => a.id !== action.id))
        } else {
          await load()
        }
        // Top bar badge'ini anında güncelle
        window.dispatchEvent(new CustomEvent('pulse-pending-actions-changed'))
      }
    } catch (err: any) {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Hata', body: err?.message || 'Beklenmeyen hata' },
      }))
    } finally {
      setBusyId(null)
    }
  }

  const openCount = actions.filter(a => a.status === 'pending' || a.status === 'scheduled').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="h-page flex items-center gap-2">
          <Inbox className="w-6 h-6 text-pulse-900 dark:text-pulse-300" />
          Asistan Aksiyonları
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Sistemin sizin için hazırladığı öneriler (kampanya, hatırlatma, geri kazanım). Onayladığınızda otomatik olarak uygulanır.
        </p>
      </div>

      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <button
          type="button"
          onClick={() => setTab('open')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'open'
              ? 'border-pulse-900 text-pulse-900 dark:text-pulse-300 dark:border-pulse-300'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300'
          }`}
        >
          Bekleyen {tab === 'open' && openCount > 0 && (
            <span className="ml-1 text-[11px] bg-pulse-900 dark:bg-pulse-300 text-white dark:text-gray-900 rounded-full px-1.5">
              {openCount}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setTab('history')}
          className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
            tab === 'history'
              ? 'border-pulse-900 text-pulse-900 dark:text-pulse-300 dark:border-pulse-300'
              : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300'
          }`}
        >
          Geçmiş
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-pulse-900 dark:text-pulse-300" />
        </div>
      ) : error ? (
        <div className="card p-6 flex items-start gap-3 border-red-200 dark:border-red-800 cursor-default">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <div className="text-sm font-semibold text-red-700 dark:text-red-300 mb-1">
              Öneriler yüklenemedi
            </div>
            <div className="text-xs text-gray-600 dark:text-gray-400">{error}</div>
          </div>
        </div>
      ) : actions.length === 0 ? (
        <EmptyState
          icon={<Bot className="w-7 h-7" />}
          title={tab === 'open' ? 'Bekleyen öneri yok' : 'Geçmiş öneri yok'}
          description={tab === 'open'
            ? 'İş Zekası sayfasındaki önerilerden "Uygula" tıklarsan burada görünür.'
            : 'Onaylanan ve reddedilen öneriler geçmişte listelenir.'}
        />
      ) : (
        <div className="space-y-3">
          {actions.map(action => (
            <ActionCard
              key={action.id}
              action={action}
              busy={busyId === action.id}
              onDecide={handleDecide}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ActionCard({
  action, busy, onDecide,
}: {
  action: PendingAction
  busy: boolean
  onDecide: (a: PendingAction, d: 'confirm' | 'cancel') => void
}) {
  const statusStyle: Record<PendingAction['status'], { label: string; badge: string; icon: React.ReactNode }> = {
    pending:   { label: 'Bekliyor',  badge: 'badge-warning', icon: <Clock className="w-3.5 h-3.5" /> },
    scheduled: { label: 'Planlı',    badge: 'badge-info',   icon: <Calendar className="w-3.5 h-3.5" /> },
    executed:  { label: 'Çalıştı',   badge: 'badge-success', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    cancelled: { label: 'İptal',     badge: 'badge-neutral', icon: <XCircle className="w-3.5 h-3.5" /> },
    expired:   { label: 'Süresi dolmuş', badge: 'badge-danger', icon: <XCircle className="w-3.5 h-3.5" /> },
  }
  const st = statusStyle[action.status]
  const remaining = action.status === 'pending' ? timeUntil(action.expires_at) : null
  const canDecide = action.status === 'pending' || action.status === 'scheduled'
  const typeLabel = ACTION_TYPE_LABELS[action.action_type] || action.action_type

  return (
    <div className="card p-4 cursor-default space-y-2">
      <div className="flex items-start justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={st.badge}>
            {st.icon} {st.label}
          </span>
          <span className="text-[11px] text-gray-500 dark:text-gray-400">
            {typeLabel}
          </span>
        </div>
        <div className="text-[11px] text-gray-400 dark:text-gray-500">
          Oluşturma: {formatDateTime(action.created_at)}
        </div>
      </div>

      <div className="text-sm text-gray-800 dark:text-gray-200 font-medium">
        {action.preview}
      </div>

      {action.scheduled_for && action.status === 'scheduled' && (
        <div className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
          <Calendar className="w-3.5 h-3.5" />
          Planlanan zaman: {formatDateTime(action.scheduled_for)}
        </div>
      )}

      {action.status === 'pending' && remaining && (
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          Onay süresi: {remaining}
        </div>
      )}

      {action.status === 'executed' && action.result?.message && (
        <div className="text-xs text-emerald-700 dark:text-emerald-300">
          {action.result.message}
        </div>
      )}

      {canDecide && (
        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
          <button
            type="button"
            onClick={() => onDecide(action, 'confirm')}
            disabled={busy}
            className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-60"
          >
            {busy ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Çalıştırılıyor</>
            ) : (
              <><PlayCircle className="w-3.5 h-3.5" /> Onayla ve Çalıştır</>
            )}
          </button>
          <button
            type="button"
            onClick={() => onDecide(action, 'cancel')}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-1 disabled:opacity-60"
          >
            <XCircle className="w-3.5 h-3.5" /> İptal
          </button>
          {action.status === 'pending' && (
            <span className="ml-auto text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
              <History className="w-3 h-3" /> Onaylanana kadar çalışmaz
            </span>
          )}
        </div>
      )}
    </div>
  )
}
