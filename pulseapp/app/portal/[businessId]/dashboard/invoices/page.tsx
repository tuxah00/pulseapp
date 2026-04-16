'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Receipt, Loader2, ChevronRight, FileX } from 'lucide-react'
import { cn, formatCurrency, formatDate } from '@/lib/utils'

interface Invoice {
  id: string
  invoice_number: string
  total: number
  paid_amount: number
  status: string
  created_at: string
  due_date: string | null
}

const STATUS_LABELS: Record<string, string> = {
  paid: 'Ödendi',
  pending: 'Bekliyor',
  partial: 'Kısmi Ödeme',
  overdue: 'Vadesi Geçmiş',
  cancelled: 'İptal',
}

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
  pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  partial: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  overdue: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  cancelled: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
}

export default function PortalInvoicesPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/portal/invoices')
        if (!res.ok) return
        const data = await res.json()
        setInvoices(data.invoices || [])
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const totalPaid = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const totalOpen = invoices
    .filter(i => ['pending', 'partial', 'overdue'].includes(i.status))
    .reduce((s, i) => s + (i.total - (i.paid_amount || 0)), 0)

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <h1 className="text-2xl font-serif font-bold text-gray-900 dark:text-gray-100">Faturalarım</h1>

      {invoices.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Ödenmiş</p>
            <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">{formatCurrency(totalPaid)}</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400">Bekleyen</p>
            <p className="mt-1 text-xl font-bold text-amber-600 dark:text-amber-400">{formatCurrency(totalOpen)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
          <div className="h-14 w-14 rounded-full bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center mx-auto mb-3">
            <FileX className="h-7 w-7 text-pulse-900/50 dark:text-pulse-300" />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Henüz faturanız bulunmuyor.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map((inv) => {
            const remaining = inv.total - (inv.paid_amount || 0)
            const progress = inv.total > 0 ? (inv.paid_amount / inv.total) * 100 : 0
            return (
              <Link
                key={inv.id}
                href={`/portal/${businessId}/dashboard/invoices/${inv.id}`}
                className="block bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-4 hover:shadow-md hover:border-pulse-900/30 dark:hover:border-pulse-700 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center flex-shrink-0">
                    <Receipt className="h-5 w-5 text-pulse-900/70 dark:text-pulse-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">{inv.invoice_number}</p>
                      <span className={cn('text-[10px] font-medium px-2 py-0.5 rounded-full border', STATUS_COLORS[inv.status] || 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400')}>
                        {STATUS_LABELS[inv.status] || inv.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(inv.created_at)}</p>
                    {inv.status === 'partial' && (
                      <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${progress}%` }} />
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 dark:text-gray-100 text-sm">{formatCurrency(inv.total)}</p>
                    {remaining > 0 && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">{formatCurrency(remaining)} kalan</p>
                    )}
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 dark:text-gray-600 group-hover:text-pulse-900 dark:group-hover:text-pulse-300 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
