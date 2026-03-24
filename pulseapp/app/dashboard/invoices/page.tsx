'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import {
  Plus, Receipt, Loader2, X, Pencil, Trash2,
  CheckCircle, Clock, AlertCircle, XCircle, Download,
  Search, ChevronDown, Printer,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { exportToCSV, printInvoicePDF } from '@/lib/utils/export'
import type { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod } from '@/types'

interface SimpleCustomer {
  id: string
  name: string
  phone: string
}

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending:   { label: 'Bekliyor',       color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',  icon: Clock },
  paid:      { label: 'Ödendi',         color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',  icon: CheckCircle },
  partial:   { label: 'Kısmi Ödeme',   color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',      icon: ChevronDown },
  overdue:   { label: 'Vadesi Geçmiş', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',          icon: AlertCircle },
  cancelled: { label: 'İptal',          color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400',         icon: XCircle },
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Nakit' },
  { value: 'card', label: 'Kart' },
  { value: 'transfer', label: 'Havale/EFT' },
  { value: 'online', label: 'Online' },
]

export default function InvoicesPage() {
  const { businessId, loading: ctxLoading, permissions } = useBusinessContext()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<SimpleCustomer[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create form state
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formItems, setFormItems] = useState<InvoiceItem[]>([{ service_name: '', quantity: 1, unit_price: 0, total: 0 }])
  const [formTaxRate, setFormTaxRate] = useState('0')
  const [formNotes, setFormNotes] = useState('')
  const [formDueDate, setFormDueDate] = useState('')

  const supabase = createClient()

  const fetchInvoices = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const params = new URLSearchParams({ businessId })
    if (statusFilter !== 'all') params.set('status', statusFilter)

    const res = await fetch(`/api/invoices?${params}`)
    const json = await res.json()
    setInvoices(json.invoices || [])
    setLoading(false)
  }, [businessId, statusFilter])

  const fetchCustomers = useCallback(async () => {
    if (!businessId) return
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    setCustomers(data || [])
  }, [businessId])

  useEffect(() => {
    if (!ctxLoading) {
      fetchInvoices()
      fetchCustomers()
    }
  }, [fetchInvoices, fetchCustomers, ctxLoading])

  function addItem() {
    setFormItems(prev => [...prev, { service_name: '', quantity: 1, unit_price: 0, total: 0 }])
  }

  function removeItem(idx: number) {
    setFormItems(prev => prev.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof InvoiceItem, value: string | number) {
    setFormItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      if (field === 'quantity' || field === 'unit_price') {
        updated.total = Number(updated.quantity) * Number(updated.unit_price)
      }
      return updated
    }))
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)

    const validItems = formItems.filter(item => item.service_name.trim() && item.unit_price > 0)
    if (validItems.length === 0) {
      setError('En az bir geçerli kalem ekleyin.')
      setSaving(false); return
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        business_id: businessId,
        customer_id: formCustomerId || null,
        items: validItems,
        tax_rate: parseFloat(formTaxRate) || 0,
        notes: formNotes || null,
        due_date: formDueDate || null,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }

    setSaving(false)
    setShowCreateModal(false)
    resetForm()
    fetchInvoices()
    setSelectedInvoice(json.invoice)
  }

  function resetForm() {
    setFormCustomerId(''); setFormItems([{ service_name: '', quantity: 1, unit_price: 0, total: 0 }])
    setFormTaxRate('0'); setFormNotes(''); setFormDueDate('')
  }

  async function markAsPaid(invoice: Invoice, paymentMethod: PaymentMethod) {
    const res = await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', payment_method: paymentMethod }),
    })
    const json = await res.json()
    if (res.ok) {
      setSelectedInvoice(json.invoice)
      fetchInvoices()
    }
  }

  async function cancelInvoice(invoice: Invoice) {
    if (!confirm('Bu faturayı iptal etmek istediğinize emin misiniz?')) return
    const res = await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    const json = await res.json()
    if (res.ok) {
      setSelectedInvoice(json.invoice)
      fetchInvoices()
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    if (!confirm(`"${invoice.invoice_number}" faturasını silmek istediğinize emin misiniz?`)) return
    await fetch(`/api/invoices?id=${invoice.id}`, { method: 'DELETE' })
    setSelectedInvoice(null)
    fetchInvoices()
  }

  function handleExport() {
    exportToCSV(
      filteredInvoices.map(inv => ({
        invoice_number: inv.invoice_number,
        customer: inv.customers?.name || '—',
        subtotal: inv.subtotal,
        tax_rate: inv.tax_rate,
        tax_amount: inv.tax_amount,
        total: inv.total,
        status: STATUS_CONFIG[inv.status]?.label || inv.status,
        payment_method: inv.payment_method || '—',
        created_at: new Date(inv.created_at).toLocaleDateString('tr-TR'),
        due_date: inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '—',
        paid_at: inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('tr-TR') : '—',
      })),
      'fatura-listesi',
      [
        { key: 'invoice_number', label: 'Fatura No' },
        { key: 'customer', label: 'Müşteri' },
        { key: 'subtotal', label: 'Ara Toplam (TL)' },
        { key: 'tax_rate', label: 'KDV Oranı (%)' },
        { key: 'tax_amount', label: 'KDV Tutarı (TL)' },
        { key: 'total', label: 'Toplam (TL)' },
        { key: 'status', label: 'Durum' },
        { key: 'payment_method', label: 'Ödeme Yöntemi' },
        { key: 'created_at', label: 'Tarih' },
        { key: 'due_date', label: 'Son Ödeme' },
        { key: 'paid_at', label: 'Ödeme Tarihi' },
      ]
    )
  }

  function handlePrintInvoice(invoice: Invoice) {
    // We need business name — get from context or use a fallback
    printInvoicePDF({
      invoiceNumber: invoice.invoice_number,
      businessName: 'İşletme', // will be overridden via context below if available
      customerName: invoice.customers?.name,
      customerPhone: invoice.customers?.phone,
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

  const filteredInvoices = invoices.filter(inv => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customers?.name.toLowerCase().includes(q) ?? false)
    )
  })

  // Summary stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const pendingTotal = invoices.filter(i => i.status === 'pending').reduce((s, i) => s + i.total, 0)
  const overdueCount = invoices.filter(i => i.status === 'overdue').length

  if (permissions && !permissions.invoices) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Faturalar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{invoices.length} fatura</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExport} className="btn-secondary text-sm gap-1.5">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Dışa Aktar</span>
          </button>
          <button onClick={() => { resetForm(); setShowCreateModal(true) }} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />Yeni Fatura
          </button>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tahsil Edilen</p>
          <p className="text-xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Bekleyen</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(pendingTotal)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Vadesi Geçmiş</p>
          <p className={cn('text-xl font-bold', overdueCount > 0 ? 'text-red-600' : 'text-gray-900 dark:text-gray-100')}>{overdueCount} fatura</p>
        </div>
      </div>

      {/* Filtreler + Arama */}
      <div className="mb-4 flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 overflow-x-auto pb-1">
          {(['all', 'pending', 'paid', 'partial', 'overdue', 'cancelled'] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', statusFilter === s ? 'bg-pulse-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}
            >
              {s === 'all' ? 'Tümü' : STATUS_CONFIG[s as InvoiceStatus]?.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" placeholder="Fatura no veya müşteri ara..." />
        </div>
      </div>

      {/* Fatura Listesi */}
      {filteredInvoices.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-24 text-center">
          <Receipt className="mb-4 h-16 w-16 text-gray-200 dark:text-gray-600" />
          <h3 className="text-base font-semibold text-gray-700 dark:text-gray-300">
            {search ? 'Aramanızla eşleşen fatura bulunamadı' : 'Henüz fatura oluşturulmamış'}
          </h3>
          {!search && (
            <>
              <p className="mt-1 mb-4 text-sm text-gray-400">İlk faturanızı oluşturmak için butona tıklayın.</p>
              <button onClick={() => { resetForm(); setShowCreateModal(true) }} className="btn-primary">
                <Plus className="mr-2 h-4 w-4" />İlk Faturayı Oluştur
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredInvoices.map((invoice) => {
            const cfg = STATUS_CONFIG[invoice.status]
            const Icon = cfg.icon
            return (
              <div
                key={invoice.id}
                onClick={() => setSelectedInvoice(invoice)}
                className={cn('card flex items-center gap-4 p-4 cursor-pointer transition-all hover:shadow-md', selectedInvoice?.id === invoice.id && 'ring-2 ring-pulse-500')}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700 flex-shrink-0">
                  <Receipt className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900 dark:text-gray-100">{invoice.invoice_number}</span>
                    <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.color)}>
                      <Icon className="h-3 w-3" />{cfg.label}
                    </span>
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {invoice.customers?.name || 'Müşterisiz'} • {new Date(invoice.created_at).toLocaleDateString('tr-TR')}
                    {invoice.due_date && ` • Son: ${new Date(invoice.due_date).toLocaleDateString('tr-TR')}`}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.total)}</p>
                  {invoice.tax_rate > 0 && <p className="text-xs text-gray-400">KDV %{invoice.tax_rate}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Fatura Detay Slide-Over ── */}
      {selectedInvoice && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 dark:bg-black/50" onClick={() => setSelectedInvoice(null)} />
          <div className="slide-panel border-l border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedInvoice.invoice_number}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{new Date(selectedInvoice.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePrintInvoice(selectedInvoice)} title="PDF Yazdır" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors">
                  <Printer className="h-4 w-4" />
                </button>
                <button onClick={() => setSelectedInvoice(null)} className="flex h-8 w-8 items-center justify-center rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Durum Badge */}
              <div className="flex justify-center">
                {(() => {
                  const cfg = STATUS_CONFIG[selectedInvoice.status]
                  const Icon = cfg.icon
                  return (
                    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', cfg.color)}>
                      <Icon className="h-4 w-4" />{cfg.label}
                    </span>
                  )
                })()}
              </div>

              {/* Müşteri */}
              {selectedInvoice.customers && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Müşteri</p>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{selectedInvoice.customers.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{selectedInvoice.customers.phone}</p>
                </div>
              )}

              {/* Kalemler */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">Kalemler</p>
                <div className="space-y-2">
                  {selectedInvoice.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{item.service_name}</span>
                        <span className="text-gray-500 dark:text-gray-400 ml-2">×{item.quantity}</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Özet */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Ara Toplam</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {selectedInvoice.tax_rate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">KDV (%{selectedInvoice.tax_rate})</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatCurrency(selectedInvoice.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-gray-100">TOPLAM</span>
                  <span className="text-pulse-600 dark:text-pulse-400">{formatCurrency(selectedInvoice.total)}</span>
                </div>
              </div>

              {/* Ek bilgiler */}
              <div className="space-y-2 text-sm">
                {selectedInvoice.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Ödeme Yöntemi</span>
                    <span className="text-gray-900 dark:text-gray-100">{PAYMENT_METHODS.find(m => m.value === selectedInvoice.payment_method)?.label}</span>
                  </div>
                )}
                {selectedInvoice.paid_at && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Ödeme Tarihi</span>
                    <span className="text-gray-900 dark:text-gray-100">{new Date(selectedInvoice.paid_at).toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
                {selectedInvoice.due_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Son Ödeme</span>
                    <span className="text-gray-900 dark:text-gray-100">{new Date(selectedInvoice.due_date).toLocaleDateString('tr-TR')}</span>
                  </div>
                )}
                {selectedInvoice.notes && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Not</p>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">{selectedInvoice.notes}</p>
                  </div>
                )}
              </div>

              {/* Aksiyonlar */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'partial' || selectedInvoice.status === 'overdue') && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Ödeme Yöntemi Seç</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => markAsPaid(selectedInvoice, m.value)}
                          className="px-3 py-2 text-sm font-medium rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <CheckCircle className="inline h-3.5 w-3.5 mr-1" />
                          {m.label} ile Ödendi
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  {selectedInvoice.status !== 'cancelled' && selectedInvoice.status !== 'paid' && (
                    <button onClick={() => cancelInvoice(selectedInvoice)} className="btn-secondary flex-1 text-sm">
                      <XCircle className="mr-1.5 h-3.5 w-3.5" />İptal Et
                    </button>
                  )}
                  <button onClick={() => deleteInvoice(selectedInvoice)} className="btn-danger flex-1 text-sm">
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Sil
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Fatura Oluştur Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yeni Fatura Oluştur</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Müşteri Seç */}
              <div>
                <label className="label">Müşteri (opsiyonel)</label>
                <select value={formCustomerId} onChange={(e) => setFormCustomerId(e.target.value)} className="input">
                  <option value="">— Müşteri seçin —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} • {c.phone}</option>)}
                </select>
              </div>

              {/* Kalemler */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Hizmet / Ürün Kalemleri</label>
                  <button type="button" onClick={addItem} className="text-xs text-pulse-600 dark:text-pulse-400 hover:underline flex items-center gap-1">
                    <Plus className="h-3 w-3" />Kalem Ekle
                  </button>
                </div>
                <div className="space-y-2">
                  {formItems.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={item.service_name}
                        onChange={(e) => updateItem(idx, 'service_name', e.target.value)}
                        className="input flex-1 min-w-0"
                        placeholder="Hizmet adı"
                      />
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(idx, 'quantity', parseFloat(e.target.value) || 1)}
                        className="input w-16 text-center"
                        min="1"
                        title="Adet"
                      />
                      <input
                        type="number"
                        value={item.unit_price || ''}
                        onChange={(e) => updateItem(idx, 'unit_price', parseFloat(e.target.value) || 0)}
                        className="input w-24 text-right"
                        placeholder="Fiyat"
                        min="0"
                        step="0.01"
                      />
                      {formItems.length > 1 && (
                        <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 flex-shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                {/* Ara Toplam */}
                <div className="mt-2 text-right text-sm text-gray-500 dark:text-gray-400">
                  Ara Toplam: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(formItems.reduce((s, i) => s + i.total, 0))}</span>
                </div>
              </div>

              {/* KDV */}
              <div>
                <label className="label">KDV Oranı (%)</label>
                <select value={formTaxRate} onChange={(e) => setFormTaxRate(e.target.value)} className="input">
                  <option value="0">KDV Yok (%0)</option>
                  <option value="1">%1</option>
                  <option value="8">%8 (Sağlık)</option>
                  <option value="10">%10</option>
                  <option value="20">%20</option>
                </select>
              </div>

              {/* Son Ödeme */}
              <div>
                <label className="label">Son Ödeme Tarihi (opsiyonel)</label>
                <input type="date" value={formDueDate} onChange={(e) => setFormDueDate(e.target.value)} className="input" />
              </div>

              {/* Not */}
              <div>
                <label className="label">Not (opsiyonel)</label>
                <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="input" rows={2} placeholder="Fatura notu..." />
              </div>

              {error && <div className="rounded-lg bg-red-50 dark:bg-red-900/20 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Fatura Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
