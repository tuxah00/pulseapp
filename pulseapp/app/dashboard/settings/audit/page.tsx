'use client'

import { useState, useEffect, useCallback } from 'react'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { Shield, Loader2, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditLog {
  id: string
  staff_name: string | null
  action: string
  resource: string
  details: Record<string, string | number | boolean | null> | null
  ip_address: string | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  create: 'Oluşturdu',
  update: 'Güncelledi',
  delete: 'Sildi',
  login: 'Giriş Yaptı',
  status_change: 'Durum Değiştirdi',
}

const RESOURCE_LABELS: Record<string, string> = {
  appointment: 'Randevu',
  customer: 'Müşteri',
  staff: 'Personel',
  service: 'Hizmet',
  settings: 'Ayarlar',
  permissions: 'Yetki',
  inventory: 'Stok',
}

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  login: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  status_change: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
}

export default function AuditPage() {
  const { staffRole, loading: ctxLoading } = useBusinessContext()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [resourceFilter, setResourceFilter] = useState('')
  const limit = 20

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: String(limit), offset: String(page * limit) })
    if (resourceFilter) params.set('resource', resourceFilter)
    const res = await fetch(`/api/audit?${params}`)
    if (res.ok) {
      const data = await res.json()
      setLogs(data.logs)
      setTotal(data.total)
    }
    setLoading(false)
  }, [page, resourceFilter])

  useEffect(() => {
    if (!ctxLoading) fetchLogs()
  }, [fetchLogs, ctxLoading])

  if (!ctxLoading && staffRole !== 'owner') {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-gray-300 mb-3" />
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz yok.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Denetim Kaydı</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">İşletmenizdeki tüm eylemler kayıt altında</p>
        </div>
      </div>

      {/* Filtreler */}
      <div className="card mb-4 flex flex-wrap gap-3 items-center p-3">
        <Filter className="h-4 w-4 text-gray-400" />
        <select
          value={resourceFilter}
          onChange={(e) => { setResourceFilter(e.target.value); setPage(0) }}
          className="input py-1.5 text-sm w-auto"
        >
          <option value="">Tüm Kaynaklar</option>
          {Object.entries(RESOURCE_LABELS).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
        <span className="text-sm text-gray-500 ml-auto">Toplam {total} kayıt</span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-pulse-500" />
        </div>
      ) : logs.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16">
          <Shield className="mb-4 h-12 w-12 text-gray-300" />
          <p className="text-gray-500">Henüz kayıt yok</p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Zaman</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Personel</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Eylem</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Kaynak</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400 hidden md:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('tr-TR')}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {log.staff_name ?? 'Sistem'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn('badge text-xs', ACTION_COLORS[log.action] ?? 'bg-gray-100 text-gray-700')}>
                          {ACTION_LABELS[log.action] ?? log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                        {RESOURCE_LABELS[log.resource] ?? log.resource}
                        {log.details?.name && <span className="ml-1 text-gray-400">— {String(log.details.name)}</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                        {log.ip_address ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sayfalama */}
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" /> Önceki
            </button>
            <span className="text-sm text-gray-500">{page + 1} / {Math.ceil(total / limit) || 1}</span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * limit >= total}
              className="btn-secondary py-1.5 px-3 flex items-center gap-1 disabled:opacity-50"
            >
              Sonraki <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
