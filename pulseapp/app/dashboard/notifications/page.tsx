'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Bell, Calendar, Star, CreditCard, Users, Settings,
  CheckCheck, Filter, Loader2, ChevronLeft, ChevronRight,
  Package, Eye, EyeOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  related_id: string | null
  related_type: string | null
  is_read: boolean
  created_at: string
}

const TYPE_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
  appointment: { icon: Calendar, color: 'text-blue-500', label: 'Randevu' },
  review: { icon: Star, color: 'text-amber-500', label: 'Yorum' },
  payment: { icon: CreditCard, color: 'text-green-500', label: 'Ödeme' },
  customer: { icon: Users, color: 'text-purple-500', label: 'Müşteri' },
  system: { icon: Settings, color: 'text-gray-500', label: 'Sistem' },
  stock_alert: { icon: Package, color: 'text-red-500', label: 'Stok Uyarısı' },
}

const FILTER_OPTIONS = [
  { value: 'all', label: 'Tümü' },
  { value: 'appointment', label: 'Randevu' },
  { value: 'review', label: 'Yorum' },
  { value: 'payment', label: 'Ödeme' },
  { value: 'customer', label: 'Müşteri' },
  { value: 'system', label: 'Sistem' },
  { value: 'stock_alert', label: 'Stok' },
]

const PAGE_SIZE = 20

export default function NotificationsPage() {
  const { loading: ctxLoading } = useBusinessContext()
  const router = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(0)

  const fetchNotifications = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      })
      if (filter !== 'all') params.set('type', filter)

      const res = await fetch(`/api/notifications?${params}`)
      if (!res.ok) throw new Error('Fetch failed')
      const json = await res.json()
      setNotifications(json.notifications || [])
      setTotal(json.total || 0)
    } catch {
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }, [filter, page])

  useEffect(() => {
    if (!ctxLoading) fetchNotifications()
  }, [fetchNotifications, ctxLoading])

  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'mark_all_read' }),
    })
    fetchNotifications()
  }

  async function toggleRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_read', ids: [id] }),
    })
    fetchNotifications()
  }

  function handleClick(notif: Notification) {
    // Mark as read
    if (!notif.is_read) {
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read', ids: [notif.id] }),
      })
    }

    // Navigate based on type
    if (notif.related_type === 'appointment') {
      router.push('/dashboard/appointments')
    } else if (notif.related_type === 'review' || notif.type === 'review') {
      router.push('/dashboard/reviews')
    } else if (notif.related_type === 'customer' || notif.type === 'customer') {
      router.push('/dashboard/customers')
    } else if (notif.type === 'stock_alert') {
      router.push('/dashboard/stoklar')
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Az önce'
    if (diffMins < 60) return `${diffMins} dk önce`
    if (diffHours < 24) return `${diffHours} saat önce`
    if (diffDays < 7) return `${diffDays} gün önce`
    return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const unreadCount = notifications.filter(n => !n.is_read).length

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Bildirimler</h1>
          <p className="text-sm text-gray-500 mt-1">
            {total} bildirim{unreadCount > 0 ? ` · ${unreadCount} okunmamış` : ''}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <CheckCheck className="h-4 w-4" /> Tümünü Okundu İşaretle
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => { setFilter(opt.value); setPage(0) }}
            className={cn(
              'px-3 py-1.5 rounded-full text-sm font-medium border transition-colors',
              filter === opt.value
                ? 'bg-pulse-600 text-white border-pulse-600'
                : 'bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-600 hover:border-gray-400'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="card text-center py-12 text-gray-400">
          <Bell className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Bildirim bulunamadı</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(notif => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system
            const Icon = config.icon
            return (
              <div
                key={notif.id}
                onClick={() => handleClick(notif)}
                className={cn(
                  'card flex items-start gap-3 cursor-pointer hover:border-gray-300 dark:hover:border-gray-500 transition-colors',
                  !notif.is_read && 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-900/10'
                )}
              >
                <div className={cn('mt-0.5 flex-shrink-0', config.color)}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn(
                      'text-sm truncate',
                      notif.is_read ? 'text-gray-700 dark:text-gray-300' : 'font-semibold text-gray-900 dark:text-gray-100'
                    )}>
                      {notif.title}
                    </p>
                    <span className="text-xs text-gray-400 flex-shrink-0">{formatDate(notif.created_at)}</span>
                  </div>
                  {notif.body && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">{notif.body}</p>
                  )}
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                    {config.label}
                  </span>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); toggleRead(notif.id) }}
                  className="flex-shrink-0 p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title={notif.is_read ? 'Okunmadı işaretle' : 'Okundu işaretle'}
                >
                  {notif.is_read ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-blue-500" />
                  )}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-30 hover:border-gray-300"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-500">
            Sayfa {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-600 disabled:opacity-30 hover:border-gray-300"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
