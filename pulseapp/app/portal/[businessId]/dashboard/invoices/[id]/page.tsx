'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Receipt, Download, Loader2, CheckCircle2, Clock, AlertTriangle, XCircle, CreditCard, Banknote,
} from 'lucide-react'
import { cn, formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { printInvoicePDF } from '@/lib/utils/export'
import PaymentClaimModal from './_components/payment-claim-modal'

interface InvoiceItem {
  service_name: string
  quantity: number
  unit_price: number
  total: number
}

interface Invoice {
  id: string
  invoice_number: string
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  paid_amount: number
  status: string
  payment_method: string | null
  payment_type: string
  installment_count: number | null
  due_date: string | null
  notes: string | null
  created_at: string
  paid_at: string | null
}

interface InvoicePayment {
  id: string
  amount: number
  method: string
  payment_type: string
  installment_number: number | null
  notes: string | null
  created_at: string
}

interface Business {
  id: string
  name: string
  phone: string | null
  address: string | null
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  paid: {
    label: 'Ödendi',
    color: 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800',
    icon: CheckCircle2,
  },
  pending: {
    label: 'Bekliyor',
    color: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
    icon: Clock,
  },
  partial: {
    label: 'Kısmi Ödeme',
    color: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
    icon: CreditCard,
  },
  overdue: {
    label: 'Vadesi Geçmiş',
    color: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
    icon: AlertTriangle,
  },
  cancelled: {
    label: 'İptal',
    color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700',
    icon: XCircle,
  },
}

const METHOD_LABELS: Record<string, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale/EFT',
  online: 'Online',
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  payment: 'Ödeme',
  deposit: 'Kapora',
  installment: 'Taksit',
  refund: 'İade',
}

export default function PortalInvoiceDetailPage() {
  const params = useParams()
  const businessId = params.businessId as string
  const invoiceId = params.id as string
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [business, setBusiness] = useState<Business | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [claimOpen, setClaimOpen] = useState(false)
  const [claimSent, setClaimSent] = useState(false)

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/portal/invoices/${invoiceId}`)
        if (!res.ok) {
          setError('Fatura bulunamadı')
          return
        }
        const data = await res.json()
        setInvoice(data.invoice)
        setPayments(data.payments || [])
        setBusiness(data.business)
      } catch {
        setError('Bağlantı hatası')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [invoiceId])

  const handleDownload = () => {
    if (!invoice || !business) return
    printInvoicePDF({
      invoiceNumber: invoice.invoice_number,
      businessName: business.name,
      items: invoice.items,
      subtotal: invoice.subtotal,
      taxRate: invoice.tax_rate,
      taxAmount: invoice.tax_amount,
      total: invoice.total,
      status: invoice.status,
      paymentMethod: invoice.payment_method,
      createdAt: invoice.created_at,
      dueDate: invoice.due_date,
      notes: invoice.notes,
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="max-w-4xl mx-auto">
        <Link
          href={`/portal/${businessId}/dashboard/invoices`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300 mb-4"
        >
          <ArrowLeft className="h-4 w-4" /> Faturalara Dön
        </Link>
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-10 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">{error || 'Fatura bulunamadı'}</p>
        </div>
      </div>
    )
  }

  const statusCfg = STATUS_CONFIG[invoice.status] || STATUS_CONFIG.pending
  const StatusIcon = statusCfg.icon
  const remaining = invoice.total - (invoice.paid_amount || 0)
  const progress = invoice.total > 0 ? (invoice.paid_amount / invoice.total) * 100 : 0

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <Link
          href={`/portal/${businessId}/dashboard/invoices`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-pulse-900 dark:hover:text-pulse-300 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" /> Faturalara Dön
        </Link>
        <button
          onClick={handleDownload}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <Download className="h-4 w-4" /> PDF İndir
        </button>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-xl bg-pulse-900/5 dark:bg-pulse-900/20 flex items-center justify-center flex-shrink-0">
              <Receipt className="h-6 w-6 text-pulse-900/70 dark:text-pulse-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{invoice.invoice_number}</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDate(invoice.created_at)}</p>
            </div>
          </div>
          <span className={cn('inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border', statusCfg.color)}>
            <StatusIcon className="h-3 w-3" /> {statusCfg.label}
          </span>
        </div>

        {invoice.status !== 'cancelled' && (
          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">
                {formatCurrency(invoice.paid_amount || 0)} / {formatCurrency(invoice.total)}
              </span>
              <span className={cn('font-medium', remaining > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400')}>
                {remaining > 0 ? `${formatCurrency(remaining)} kalan` : 'Tamamen ödendi'}
              </span>
            </div>
            <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all', progress >= 100 ? 'bg-green-500' : 'bg-blue-500')}
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>
        )}

        {invoice.due_date && invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
          <div className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Son ödeme tarihi: <span className="font-medium text-gray-700 dark:text-gray-300">{formatDate(invoice.due_date)}</span>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Fatura Kalemleri</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800/50">
                <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Hizmet / Ürün</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Adet</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Birim</th>
                <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {invoice.items.map((item, i) => (
                <tr key={i}>
                  <td className="px-5 py-3 text-sm text-gray-900 dark:text-gray-100">{item.service_name}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 text-center">{item.quantity}</td>
                  <td className="px-3 py-3 text-sm text-gray-600 dark:text-gray-300 text-right">{formatCurrency(item.unit_price)}</td>
                  <td className="px-5 py-3 text-sm font-semibold text-gray-900 dark:text-gray-100 text-right">{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-gray-50 dark:bg-gray-800/50 px-5 py-4">
          <div className="ml-auto max-w-xs space-y-1.5 text-sm">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>Ara Toplam</span>
              <span>{formatCurrency(invoice.subtotal)}</span>
            </div>
            {invoice.tax_rate > 0 && (
              <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                <span>KDV (%{invoice.tax_rate})</span>
                <span>{formatCurrency(invoice.tax_amount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-700 font-bold text-gray-900 dark:text-gray-100 text-base">
              <span>Toplam</span>
              <span>{formatCurrency(invoice.total)}</span>
            </div>
          </div>
        </div>
      </div>

      {payments.length > 0 && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ödeme Geçmişi</h2>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {payments.map((p) => (
              <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(p.amount)}</p>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                      {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}
                      {p.installment_number ? ` ${p.installment_number}` : ''}
                    </span>
                    <span className="text-[10px] text-gray-400 dark:text-gray-500">• {METHOD_LABELS[p.method] || p.method}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{formatDateTime(p.created_at)}</p>
                  {p.notes && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{p.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {invoice.notes && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Notlar</h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap">{invoice.notes}</p>
        </div>
      )}

      {/* Ödeme bildirimi butonu — fatura ödenmediyse */}
      {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-5">
          {claimSent ? (
            <div className="flex items-start gap-3 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
              <CheckCircle2 className="w-5 h-5 text-green-700 dark:text-green-300 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-green-900 dark:text-green-200">Bildiriminiz iletildi</p>
                <p className="text-xs text-green-800/80 dark:text-green-200/80 mt-0.5">
                  Personel onayladıktan sonra fatura ödendi olarak işaretlenecek.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Ödediniz mi?</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Havale veya nakit yaptıysanız bildirin, personel onayını bekleyin.
                </p>
              </div>
              <button
                onClick={() => setClaimOpen(true)}
                className="btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm"
              >
                <Banknote className="w-4 h-4" /> Ödediğimi Bildir
              </button>
            </div>
          )}
        </div>
      )}

      <PaymentClaimModal
        open={claimOpen}
        invoiceId={invoiceId}
        defaultAmount={remaining > 0 ? remaining : invoice.total}
        onClose={() => setClaimOpen(false)}
        onSubmitted={() => setClaimSent(true)}
      />
    </div>
  )
}
