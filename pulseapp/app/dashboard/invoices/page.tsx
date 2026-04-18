'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useDebounce } from '@/lib/hooks/use-debounce'
import { useConfirm } from '@/lib/hooks/use-confirm'
import {
  Plus, Receipt, Loader2, X, Trash2,
  CheckCircle, Clock, AlertCircle, XCircle, Download,
  Search, ChevronDown, Printer, CreditCard, Banknote,
  ArrowUpDown, Filter, CalendarDays, DollarSign,
  FileText, FileSpreadsheet, ChevronRight, Send, ExternalLink, RotateCcw,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { exportToCSV, printInvoicePDF } from '@/lib/utils/export'
import { logAudit } from '@/lib/utils/audit'
import type { Invoice, InvoiceItem, InvoiceStatus, PaymentMethod, InvoicePayment, InvoicePaymentType, InstallmentFrequency } from '@/types'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { CustomSelect } from '@/components/ui/custom-select'
import { CustomerSearchSelect } from '@/components/ui/customer-search-select'
import { getCustomerLabelSingular } from '@/lib/config/sector-modules'
import { Portal } from '@/components/ui/portal'
import { Pagination } from '@/components/ui/pagination'
import EmptyState from '@/components/ui/empty-state'

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

const PAYMENT_METHODS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: 'cash', label: 'Nakit', icon: Banknote },
  { value: 'card', label: 'Kart', icon: CreditCard },
  { value: 'transfer', label: 'Havale/EFT', icon: ArrowUpDown },
  { value: 'online', label: 'Online', icon: DollarSign },
]

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  payment: 'Ödeme',
  deposit: 'Kapora',
  installment: 'Taksit',
  refund: 'İade',
}

export default function InvoicesPage() {
  const { businessId, staffId, staffName, sector, loading: ctxLoading, permissions } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)
  const PAGE_SIZE = 50
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null)
  const [panelClosing, setPanelClosing] = useState(false)
  const closePanelAnimated = useCallback(() => setPanelClosing(true), [])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [isClosingCreateModal, setIsClosingCreateModal] = useState(false)
  const closeCreateModal = () => setIsClosingCreateModal(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Advanced filters
  const [showFilters, setShowFilters] = useState(false)
  const [filterCustomerId, setFilterCustomerId] = useState('')
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterAmountMin, setFilterAmountMin] = useState('')
  const [filterAmountMax, setFilterAmountMax] = useState('')
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // Create form state
  const [formCustomerId, setFormCustomerId] = useState('')
  const [formItems, setFormItems] = useState<InvoiceItem[]>([{ service_name: '', quantity: 1, unit_price: 0, total: 0 }])
  const [formTaxRate, setFormTaxRate] = useState('0')
  const [formNotes, setFormNotes] = useState('')
  const [formDueDate, setFormDueDate] = useState('')
  const [formPaymentType, setFormPaymentType] = useState<InvoicePaymentType>('standard')
  const [formInstallmentCount, setFormInstallmentCount] = useState('3')
  const [formInstallmentFrequency, setFormInstallmentFrequency] = useState<InstallmentFrequency>('monthly')
  const [formDepositAmount, setFormDepositAmount] = useState('')
  const [formDepositMethod, setFormDepositMethod] = useState<PaymentMethod>('cash')
  const [formDiscountType, setFormDiscountType] = useState<'percentage' | 'fixed'>('fixed')
  const [formDiscountAmount, setFormDiscountAmount] = useState('')
  const [formDiscountDescription, setFormDiscountDescription] = useState('')
  const [formCustomTaxRate, setFormCustomTaxRate] = useState('')
  const [formTaxId, setFormTaxId] = useState('')
  const [formTaxOffice, setFormTaxOffice] = useState('')
  const [formCompanyName, setFormCompanyName] = useState('')

  // Payment history
  const [payments, setPayments] = useState<InvoicePayment[]>([])
  const [loadingPayments, setLoadingPayments] = useState(false)
  const [showPaymentForm, setShowPaymentForm] = useState(false)
  const [payAmount, setPayAmount] = useState('')
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [payNotes, setPayNotes] = useState('')
  const [payingSaving, setPayingSaving] = useState(false)

  // Çöp kutusu (silinmiş faturalar)
  const [showDeleted, setShowDeleted] = useState(false)
  const [deletedInvoices, setDeletedInvoices] = useState<Invoice[]>([])
  const [deletedLoading, setDeletedLoading] = useState(false)

  // Export dropdown
  const [showExportMenu, setShowExportMenu] = useState(false)

  // e-Fatura
  const [efaturaSending, setEfaturaSending] = useState(false)
  const [efaturaError, setEfaturaError] = useState<string | null>(null)

  const { confirm } = useConfirm()
  const supabase = createClient()

  const hasActiveFilters = !!(filterCustomerId || filterPaymentMethod || filterFrom || filterTo || filterAmountMin || filterAmountMax)

  useEffect(() => { setPage(0) }, [statusFilter, filterCustomerId, filterPaymentMethod, filterFrom, filterTo, filterAmountMin, filterAmountMax, sortBy, sortOrder])

  const fetchInvoices = useCallback(async () => {
    if (!businessId) return
    setLoading(true)
    const params = new URLSearchParams({ businessId })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (filterCustomerId) params.set('customer_id', filterCustomerId)
    if (filterPaymentMethod) params.set('payment_method', filterPaymentMethod)
    if (filterFrom) params.set('from', filterFrom)
    if (filterTo) params.set('to', filterTo)
    if (filterAmountMin) params.set('amount_min', filterAmountMin)
    if (filterAmountMax) params.set('amount_max', filterAmountMax)
    params.set('sort_by', sortBy)
    params.set('sort_order', sortOrder)
    params.set('page', String(page))
    params.set('pageSize', String(PAGE_SIZE))

    const res = await fetch(`/api/invoices?${params}`)
    const json = await res.json()
    setInvoices(json.invoices || [])
    setTotalCount(json.total || 0)
    setLoading(false)
  }, [businessId, statusFilter, filterCustomerId, filterPaymentMethod, filterFrom, filterTo, filterAmountMin, filterAmountMax, sortBy, sortOrder, page])

  const fetchDeletedInvoices = useCallback(async () => {
    if (!businessId) return
    setDeletedLoading(true)
    const res = await fetch(`/api/invoices?showDeleted=true`)
    const json = await res.json()
    setDeletedInvoices(json.invoices || [])
    setDeletedLoading(false)
  }, [businessId])

  const fetchPayments = useCallback(async (invoiceId: string) => {
    setLoadingPayments(true)
    const res = await fetch(`/api/invoices/payments?invoiceId=${invoiceId}`)
    const json = await res.json()
    setPayments(json.payments || [])
    setLoadingPayments(false)
  }, [])

  useEffect(() => {
    if (!ctxLoading) {
      fetchInvoices()
    }
  }, [fetchInvoices, ctxLoading])

  useEffect(() => {
    if (showDeleted) fetchDeletedInvoices()
  }, [showDeleted, fetchDeletedInvoices])

  useEffect(() => {
    if (selectedInvoice) {
      fetchPayments(selectedInvoice.id)
    } else {
      setPayments([])
      setShowPaymentForm(false)
    }
  }, [selectedInvoice, fetchPayments])

  useEffect(() => {
    if (!showCreateModal) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') closeCreateModal() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [showCreateModal])

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

    const effectiveTaxRate = formTaxRate === 'custom'
      ? (parseFloat(formCustomTaxRate) || 0)
      : (parseFloat(formTaxRate) || 0)

    const payload: Record<string, unknown> = {
      business_id: businessId,
      customer_id: formCustomerId || null,
      items: validItems,
      tax_rate: effectiveTaxRate,
      notes: formNotes || null,
      due_date: formDueDate || null,
      staff_id: staffId,
      staff_name: staffName,
      payment_type: formPaymentType,
      discount_amount: parseFloat(formDiscountAmount) || 0,
      discount_type: formDiscountAmount ? formDiscountType : null,
      discount_description: formDiscountDescription || null,
      customer_tax_id: formTaxId || null,
      customer_tax_office: formTaxOffice || null,
      customer_company_name: formCompanyName || null,
    }

    if (formPaymentType === 'installment') {
      payload.installment_count = parseInt(formInstallmentCount) || 3
      payload.installment_frequency = formInstallmentFrequency
    }
    if (formPaymentType === 'deposit' && formDepositAmount) {
      payload.deposit_amount = parseFloat(formDepositAmount) || 0
      payload.payment_method = formDepositMethod
    }

    const res = await fetch('/api/invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error); setSaving(false); return }

    setSaving(false)
    closeCreateModal()
    resetForm()
    fetchInvoices()
    setSelectedInvoice(json.invoice)
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Oluşturuldu' } }))
    logAudit({ businessId: businessId!, staffId, staffName, action: 'create', resource: 'invoice', resourceId: json.invoice?.id, details: { customer_id: formCustomerId || null, total: json.invoice?.total ?? null, payment_type: formPaymentType } })
  }

  async function sendEfatura(invoice: Invoice) {
    setEfaturaSending(true); setEfaturaError(null)
    const res = await fetch('/api/efatura', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoiceId: invoice.id }),
    })
    const json = await res.json()
    if (!res.ok) {
      setEfaturaError(json.error || 'e-Fatura gönderilemedi')
    } else {
      setSelectedInvoice(prev => prev ? { ...prev, efatura_id: json.efatura?.id, efatura_status: 'sent' } : prev)
      fetchInvoices()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    }
    setEfaturaSending(false)
  }

  function resetForm() {
    setFormCustomerId(''); setFormItems([{ service_name: '', quantity: 1, unit_price: 0, total: 0 }])
    setFormTaxRate('0'); setFormNotes(''); setFormDueDate('')
    setFormPaymentType('standard'); setFormInstallmentCount('3')
    setFormInstallmentFrequency('monthly'); setFormDepositAmount(''); setFormDepositMethod('cash')
    setFormDiscountType('fixed'); setFormDiscountAmount(''); setFormDiscountDescription('')
    setFormCustomTaxRate(''); setFormTaxId(''); setFormTaxOffice(''); setFormCompanyName('')
  }

  async function handleRecordPayment() {
    if (!selectedInvoice || !payAmount) return
    setPayingSaving(true)

    const res = await fetch('/api/invoices/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice_id: selectedInvoice.id,
        amount: parseFloat(payAmount),
        method: payMethod,
        payment_type: selectedInvoice.payment_type === 'installment' ? 'installment' : 'payment',
        installment_number: selectedInvoice.payment_type === 'installment' ? (payments.filter(p => p.payment_type === 'installment').length + 1) : null,
        notes: payNotes || null,
        staff_id: staffId,
        staff_name: staffName,
      }),
    })
    const json = await res.json()
    if (res.ok) {
      setSelectedInvoice(json.invoice)
      fetchPayments(selectedInvoice.id)
      fetchInvoices()
      setShowPaymentForm(false)
      setPayAmount(''); setPayNotes('')
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
      logAudit({ businessId: businessId!, staffId, staffName, action: 'pay', resource: 'invoice', resourceId: selectedInvoice.id, details: { amount: parseFloat(payAmount), method: payMethod } })
    }
    setPayingSaving(false)
  }

  async function markAsPaid(invoice: Invoice, paymentMethod: PaymentMethod) {
    const res = await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paid', payment_method: paymentMethod, staff_id: staffId, staff_name: staffName }),
    })
    const json = await res.json()
    if (res.ok) {
      setSelectedInvoice(json.invoice)
      fetchInvoices()
      if (json.invoice) fetchPayments(json.invoice.id)
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
      logAudit({ businessId: businessId!, staffId, staffName, action: 'pay', resource: 'invoice', resourceId: invoice.id, details: { amount: invoice.total ?? null, payment_method: paymentMethod } })
    }
  }

  async function cancelInvoice(invoice: Invoice) {
    const ok = await confirm({ title: 'Onay', message: 'Bu faturayı iptal etmek istediğinize emin misiniz?' })
    if (!ok) return
    const res = await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    })
    const json = await res.json()
    if (res.ok) {
      setSelectedInvoice(json.invoice)
      fetchInvoices()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    }
  }

  async function deleteInvoice(invoice: Invoice) {
    const ok = await confirm({ title: 'Onay', message: `"${invoice.invoice_number}" faturasını silmek istediğinize emin misiniz?` })
    if (!ok) return
    await fetch(`/api/invoices?id=${invoice.id}`, { method: 'DELETE' })
    setSelectedInvoice(null)
    fetchInvoices()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
    logAudit({ businessId: businessId!, staffId, staffName, action: 'delete', resource: 'invoice', resourceId: invoice.id, details: { invoice_number: invoice.invoice_number } })
  }

  async function handleRestore(invoice: Invoice) {
    const ok = await confirm({ title: 'Onay', message: `"${invoice.invoice_number}" faturasını geri almak istediğinize emin misiniz?` })
    if (!ok) return
    await fetch(`/api/invoices?id=${invoice.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ restore: true }),
    })
    fetchDeletedInvoices()
    fetchInvoices()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Kaydedildi' } }))
    logAudit({ businessId: businessId!, staffId, staffName, action: 'restore', resource: 'invoice', resourceId: invoice.id, details: { invoice_number: invoice.invoice_number } })
  }

  function handleExportCSV() {
    setShowExportMenu(false)
    exportToCSV(
      filteredInvoices.map(inv => ({
        invoice_number: inv.invoice_number,
        customer: inv.customers?.name || '—',
        company_name: inv.customer_company_name || '—',
        tax_id: inv.customer_tax_id || '—',
        tax_office: inv.customer_tax_office || '—',
        subtotal: inv.subtotal,
        discount: inv.discount_amount || 0,
        tax_rate: inv.tax_rate,
        tax_amount: inv.tax_amount,
        total: inv.total,
        paid_amount: inv.paid_amount || 0,
        status: STATUS_CONFIG[inv.status]?.label || inv.status,
        payment_method: inv.payment_method || '—',
        payment_type: inv.payment_type === 'installment' ? 'Taksitli' : inv.payment_type === 'deposit' ? 'Kaporalı' : 'Standart',
        created_at: new Date(inv.created_at).toLocaleDateString('tr-TR'),
        due_date: inv.due_date ? new Date(inv.due_date).toLocaleDateString('tr-TR') : '—',
        paid_at: inv.paid_at ? new Date(inv.paid_at).toLocaleDateString('tr-TR') : '—',
      })),
      'fatura-listesi',
      [
        { key: 'invoice_number', label: 'Fatura No' },
        { key: 'customer', label: customerLabel },
        { key: 'company_name', label: 'Firma Adı' },
        { key: 'tax_id', label: 'VKN/TCKN' },
        { key: 'tax_office', label: 'Vergi Dairesi' },
        { key: 'subtotal', label: 'Ara Toplam (TL)' },
        { key: 'discount', label: 'İndirim (TL)' },
        { key: 'tax_rate', label: 'KDV Oranı (%)' },
        { key: 'tax_amount', label: 'KDV Tutarı (TL)' },
        { key: 'total', label: 'Toplam (TL)' },
        { key: 'paid_amount', label: 'Ödenen (TL)' },
        { key: 'status', label: 'Durum' },
        { key: 'payment_method', label: 'Ödeme Yöntemi' },
        { key: 'payment_type', label: 'Ödeme Tipi' },
        { key: 'created_at', label: 'Tarih' },
        { key: 'due_date', label: 'Son Ödeme' },
        { key: 'paid_at', label: 'Ödeme Tarihi' },
      ]
    )
  }

  function handlePrintInvoice(invoice: Invoice) {
    printInvoicePDF({
      invoiceNumber: invoice.invoice_number,
      businessName: 'İşletme',
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
      discountAmount: invoice.discount_amount,
      discountDescription: invoice.discount_description,
      customerTaxId: invoice.customer_tax_id,
      customerTaxOffice: invoice.customer_tax_office,
      customerCompanyName: invoice.customer_company_name,
    })
  }

  function clearFilters() {
    setFilterCustomerId(''); setFilterPaymentMethod('')
    setFilterFrom(''); setFilterTo('')
    setFilterAmountMin(''); setFilterAmountMax('')
    setSortBy('created_at'); setSortOrder('desc')
  }

  const filteredInvoices = invoices.filter(inv => {
    if (!debouncedSearch.trim()) return true
    const q = debouncedSearch.toLowerCase()
    return (
      inv.invoice_number.toLowerCase().includes(q) ||
      (inv.customers?.name.toLowerCase().includes(q) ?? false)
    )
  })

  // Summary stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((s, i) => s + i.total, 0)
  const pendingTotal = invoices.filter(i => i.status === 'pending' || i.status === 'partial').reduce((s, i) => s + i.total - (i.paid_amount || 0), 0)
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

  if (loading && invoices.length === 0) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  const paidAmountSafe = (inv: Invoice) => inv.paid_amount || 0
  const remainingAmount = selectedInvoice ? selectedInvoice.total - paidAmountSafe(selectedInvoice) : 0
  const progressPercent = selectedInvoice ? Math.min(100, (paidAmountSafe(selectedInvoice) / selectedInvoice.total) * 100) : 0

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Faturalar</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{invoices.length} fatura</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Export Dropdown */}
          <div className="relative">
            <button onClick={() => setShowExportMenu(!showExportMenu)} className="btn-secondary text-sm gap-1.5">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Dışa Aktar</span>
              <ChevronDown className="h-3 w-3" />
            </button>
            {showExportMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-20 w-44 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg py-1">
                  <button onClick={handleExportCSV} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <FileText className="h-4 w-4" />CSV
                  </button>
                  <button onClick={() => { setShowExportMenu(false); import('@/lib/utils/export').then(m => m.exportInvoiceListPDF?.(filteredInvoices, STATUS_CONFIG)) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <FileText className="h-4 w-4 text-red-500" />PDF
                  </button>
                  <button onClick={() => { setShowExportMenu(false); import('@/lib/utils/export').then(m => m.exportInvoiceListXLSX?.(filteredInvoices)) }} className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700">
                    <FileSpreadsheet className="h-4 w-4 text-green-500" />Excel
                  </button>
                </div>
              </>
            )}
          </div>
          <button onClick={() => { resetForm(); setShowCreateModal(true) }} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />Yeni Fatura
          </button>
        </div>
      </div>

      {/* Özet Kartlar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <button onClick={() => setStatusFilter(statusFilter === 'paid' ? 'all' : 'paid')} className={cn('relative overflow-hidden rounded-2xl border border-green-100 dark:border-green-900/40 bg-green-50 dark:bg-green-950/30 p-4 text-left transition-all hover:shadow-sm', statusFilter === 'paid' && 'ring-2 ring-green-500')}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tahsil Edilen</p>
          <p className="text-xl font-bold bg-gradient-to-r from-emerald-500 to-teal-600 bg-clip-text text-transparent">{formatCurrency(totalRevenue)}</p>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'pending' ? 'all' : 'pending')} className={cn('relative overflow-hidden rounded-2xl border border-amber-100 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 p-4 text-left transition-all hover:shadow-sm', statusFilter === 'pending' && 'ring-2 ring-amber-500')}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Bekleyen</p>
          <p className="text-xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent">{formatCurrency(pendingTotal)}</p>
        </button>
        <button onClick={() => setStatusFilter(statusFilter === 'overdue' ? 'all' : 'overdue')} className={cn('relative overflow-hidden rounded-2xl border border-red-100 dark:border-red-900/40 bg-red-50 dark:bg-red-950/30 p-4 text-left transition-all hover:shadow-sm', statusFilter === 'overdue' && 'ring-2 ring-red-500')}>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Vadesi Geçmiş</p>
          <p className={cn('text-xl font-bold', overdueCount > 0 ? 'bg-gradient-to-r from-red-500 to-rose-600 bg-clip-text text-transparent' : 'text-gray-900 dark:text-gray-100')}>{overdueCount} fatura</p>
        </button>
      </div>

      {/* Filtreler + Arama */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex gap-1 overflow-x-auto pb-1">
            {(['all', 'pending', 'paid', 'partial', 'overdue', 'cancelled'] as const).map(s => (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setShowDeleted(false) }}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', !showDeleted && statusFilter === s ? 'bg-pulse-900 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}
              >
                {s === 'all' ? 'Tümü' : STATUS_CONFIG[s as InvoiceStatus]?.label}
              </button>
            ))}
            <button
              onClick={() => setShowDeleted(v => !v)}
              className={cn('flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors', showDeleted ? 'bg-red-600 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Çöp Kutusu
            </button>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button onClick={() => setShowFilters(!showFilters)} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors', showFilters || hasActiveFilters ? 'bg-pulse-100 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-400' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600')}>
              <Filter className="h-3.5 w-3.5" />
              Filtre
              {hasActiveFilters && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-pulse-900" />}
            </button>
            <div className="relative flex-1 min-w-[180px] max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-9 text-sm" placeholder="Fatura no veya müşteri..." />
            </div>
          </div>
        </div>

        {/* Gelişmiş Filtreler Panel */}
        {showFilters && (
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 p-4 space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Müşteri</label>
                <CustomerSearchSelect
                  value={filterCustomerId}
                  onChange={v => setFilterCustomerId(v)}
                  businessId={businessId!}
                  placeholder="Tümü"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Ödeme Yöntemi</label>
                <CustomSelect
                  value={filterPaymentMethod}
                  onChange={v => setFilterPaymentMethod(v)}
                  placeholder="Tümü"
                  options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><CalendarDays className="inline h-3 w-3 mr-1" />Başlangıç</label>
                <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1"><CalendarDays className="inline h-3 w-3 mr-1" />Bitiş</label>
                <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} className="input text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Min Tutar</label>
                <input type="number" value={filterAmountMin} onChange={e => setFilterAmountMin(e.target.value)} className="input text-sm" placeholder="₺0" min="0" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max Tutar</label>
                <input type="number" value={filterAmountMax} onChange={e => setFilterAmountMax(e.target.value)} className="input text-sm" placeholder="₺∞" min="0" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Sırala:</label>
                <CustomSelect
                  value={sortBy}
                  onChange={v => setSortBy(v)}
                  options={[
                    { value: 'created_at', label: 'Tarih' },
                    { value: 'total', label: 'Tutar' },
                    { value: 'due_date', label: 'Son Ödeme' },
                    { value: 'paid_amount', label: 'Ödenen' },
                  ]}
                />
                <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-1">
                  <ArrowUpDown className="h-3 w-3" />
                  {sortOrder === 'desc' ? 'Azalan' : 'Artan'}
                </button>
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400">
                  Filtreleri Temizle
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Çöp Kutusu — Silinmiş Faturalar */}
      {showDeleted && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400">
            <Trash2 className="h-4 w-4" />
            Çöp Kutusu — {deletedInvoices.length} silinmiş fatura
          </div>
          {deletedLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
            </div>
          ) : deletedInvoices.length === 0 ? (
            <EmptyState icon={<Trash2 className="h-7 w-7" />} title="Silinmiş fatura yok" />
          ) : (
            <div className="space-y-2">
              {deletedInvoices.map(invoice => (
                <div key={invoice.id} className="card flex items-center gap-4 p-4 opacity-70">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 flex-shrink-0">
                    <Receipt className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{invoice.invoice_number}</span>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                        <Trash2 className="h-3 w-3" />Silinmiş
                      </span>
                    </div>
                    <div className="mt-0.5 text-sm text-gray-400">
                      {invoice.customers?.name || `${customerLabel} belirtilmedi`} &bull; {formatCurrency(invoice.total)} &bull; Silinme: {invoice.deleted_at ? new Date(invoice.deleted_at).toLocaleDateString('tr-TR') : '—'}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRestore(invoice)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Geri Al
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Fatura Listesi */}
      {!showDeleted && (filteredInvoices.length === 0 ? (
        <EmptyState
          icon={<Receipt className="h-7 w-7" />}
          title={search || hasActiveFilters ? 'Aramanızla eşleşen fatura bulunamadı' : 'Henüz fatura oluşturulmamış'}
          description={!search && !hasActiveFilters ? 'İlk faturanızı oluşturmak için butona tıklayın.' : undefined}
          action={!search && !hasActiveFilters ? {
            label: 'İlk Faturayı Oluştur',
            onClick: () => { resetForm(); setShowCreateModal(true) },
            icon: <Plus className="mr-2 h-4 w-4" />,
          } : undefined}
        />
      ) : (
        <AnimatedList className="space-y-2">
          {filteredInvoices.map((invoice) => {
            const cfg = STATUS_CONFIG[invoice.status]
            const Icon = cfg.icon
            const paidAmt = paidAmountSafe(invoice)
            const hasPaidProgress = invoice.status === 'partial' && paidAmt > 0
            return (
              <AnimatedItem
                key={invoice.id}
                onClick={() => setSelectedInvoice(invoice)}
                className={cn('card flex items-center gap-4 p-4 cursor-pointer transition-all hover:shadow-md', selectedInvoice?.id === invoice.id && 'ring-2 ring-pulse-900')}
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
                    {invoice.payment_type === 'installment' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">Taksit</span>
                    )}
                    {invoice.payment_type === 'deposit' && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">Kapora</span>
                    )}
                    {invoice.pos_transaction_id && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">Kasa</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    {invoice.customers?.name || `${customerLabel} belirtilmedi`} &bull; {new Date(invoice.created_at).toLocaleDateString('tr-TR')}
                    {invoice.due_date && ` \u00B7 Son: ${new Date(invoice.due_date).toLocaleDateString('tr-TR')}`}
                  </div>
                  {hasPaidProgress && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(100, (paidAmt / invoice.total) * 100)}%` }} />
                      </div>
                      <span className="text-[10px] text-gray-400">{formatCurrency(paidAmt)} / {formatCurrency(invoice.total)}</span>
                    </div>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(invoice.total)}</p>
                  {invoice.tax_rate > 0 && <p className="text-xs text-gray-400">KDV %{invoice.tax_rate}</p>}
                </div>
              </AnimatedItem>
            )
          })}
        </AnimatedList>
      ))}

      {/* Pagination */}
      <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={setPage} />

      {/* ── Fatura Detay Slide-Over ── */}
      {selectedInvoice && (
        <Portal>
          <div className="fixed inset-0 z-[100] bg-black/50 dark:bg-black/70" onClick={closePanelAnimated} />
          <div
            className={`slide-panel border-l border-gray-200 dark:border-gray-700 ${panelClosing ? 'closing' : ''}`}
            onAnimationEnd={() => { if (panelClosing) { setSelectedInvoice(null); setPanelClosing(false) } }}
          >
            <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-700 px-5 py-4">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{selectedInvoice.invoice_number}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{new Date(selectedInvoice.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePrintInvoice(selectedInvoice)} title="PDF Yazdır" className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 transition-colors">
                  <Printer className="h-4 w-4" />
                </button>
                <button onClick={closePanelAnimated} className="flex h-8 w-8 items-center justify-center rounded-lg p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Durum + Badge'ler */}
              <div className="flex justify-center gap-2 flex-wrap">
                {(() => {
                  const cfg = STATUS_CONFIG[selectedInvoice.status]
                  const Icon = cfg.icon
                  return (
                    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium', cfg.color)}>
                      <Icon className="h-4 w-4" />{cfg.label}
                    </span>
                  )
                })()}
                {selectedInvoice.payment_type === 'installment' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {selectedInvoice.installment_count} Taksit &bull; {selectedInvoice.installment_frequency === 'monthly' ? 'Aylık' : selectedInvoice.installment_frequency === 'weekly' ? 'Haftalık' : '2 Haftalık'}
                  </span>
                )}
                {selectedInvoice.payment_type === 'deposit' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                    Kaporalı
                  </span>
                )}
                {selectedInvoice.pos_transaction_id && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                    Kasadan Oluşturuldu
                  </span>
                )}
              </div>

              {/* Ödeme İlerleme Çubuğu */}
              {selectedInvoice.status !== 'cancelled' && (
                <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3">
                  <div className="flex justify-between text-xs mb-2">
                    <span className="text-gray-500 dark:text-gray-400">Ödeme Durumu</span>
                    <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(paidAmountSafe(selectedInvoice))} / {formatCurrency(selectedInvoice.total)}</span>
                  </div>
                  <div className="h-2.5 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-500', progressPercent >= 100 ? 'bg-green-500' : progressPercent > 0 ? 'bg-blue-500' : 'bg-gray-300 dark:bg-gray-500')}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  {remainingAmount > 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">Kalan: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(remainingAmount)}</span></p>
                  )}
                </div>
              )}

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
                        <span className="text-gray-500 dark:text-gray-400 ml-2">&times;{item.quantity}</span>
                      </div>
                      <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Vergi Bilgileri */}
              {(selectedInvoice.customer_tax_id || selectedInvoice.customer_company_name) && (
                <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 text-sm space-y-1">
                  {selectedInvoice.customer_company_name && (
                    <div className="font-medium text-gray-900 dark:text-gray-100">{selectedInvoice.customer_company_name}</div>
                  )}
                  {selectedInvoice.customer_tax_id && (
                    <div className="text-gray-600 dark:text-gray-400">VKN/TCKN: {selectedInvoice.customer_tax_id}</div>
                  )}
                  {selectedInvoice.customer_tax_office && (
                    <div className="text-gray-600 dark:text-gray-400">Vergi Dairesi: {selectedInvoice.customer_tax_office}</div>
                  )}
                </div>
              )}

              {/* Özet */}
              <div className="rounded-lg bg-gray-50 dark:bg-gray-700/50 p-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Ara Toplam</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatCurrency(selectedInvoice.subtotal)}</span>
                </div>
                {(selectedInvoice.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>İndirim{selectedInvoice.discount_description ? ` (${selectedInvoice.discount_description})` : ''}</span>
                    <span>-{formatCurrency(selectedInvoice.discount_amount)}</span>
                  </div>
                )}
                {selectedInvoice.tax_rate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">KDV (%{selectedInvoice.tax_rate})</span>
                    <span className="text-gray-900 dark:text-gray-100">{formatCurrency(selectedInvoice.tax_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-600 pt-2">
                  <span className="text-gray-900 dark:text-gray-100">TOPLAM</span>
                  <span className="text-pulse-900 dark:text-pulse-400">{formatCurrency(selectedInvoice.total)}</span>
                </div>
              </div>

              {/* Ödeme Geçmişi */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Ödeme Geçmişi</p>
                  {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'partial' || selectedInvoice.status === 'overdue') && (
                    <button onClick={() => { setShowPaymentForm(!showPaymentForm); setPayAmount(String(remainingAmount > 0 ? remainingAmount : '')); }} className="text-xs text-pulse-900 dark:text-pulse-400 hover:underline flex items-center gap-1">
                      <Plus className="h-3 w-3" />Ödeme Kaydet
                    </button>
                  )}
                </div>

                {/* Ödeme Kayıt Formu */}
                {showPaymentForm && (
                  <div className="rounded-lg border border-pulse-200 dark:border-pulse-800 bg-pulse-50/50 dark:bg-pulse-900/10 p-3 mb-3 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Tutar</label>
                        <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="input text-sm" placeholder="₺" min="0" step="0.01" />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 dark:text-gray-400 mb-0.5">Yöntem</label>
                        <CustomSelect
                          value={payMethod}
                          onChange={v => setPayMethod(v as PaymentMethod)}
                          options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                        />
                      </div>
                    </div>
                    <input type="text" value={payNotes} onChange={e => setPayNotes(e.target.value)} className="input text-sm" placeholder="Not (opsiyonel)" />
                    <div className="flex gap-2">
                      <button onClick={() => setShowPaymentForm(false)} className="btn-secondary flex-1 text-xs py-1.5">Vazgeç</button>
                      <button onClick={handleRecordPayment} disabled={payingSaving || !payAmount} className="btn-primary flex-1 text-xs py-1.5">
                        {payingSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <CheckCircle className="h-3 w-3 mr-1" />}
                        Kaydet
                      </button>
                    </div>
                  </div>
                )}

                {loadingPayments ? (
                  <div className="text-center py-3"><Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" /></div>
                ) : payments.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-3">Henüz ödeme kaydı yok.</p>
                ) : (
                  <div className="relative pl-4 space-y-3">
                    <div className="absolute left-1.5 top-1 bottom-1 w-px bg-gray-200 dark:bg-gray-700" />
                    {payments.map((p) => (
                      <div key={p.id} className="relative">
                        <div className={cn('absolute -left-2.5 top-1 h-2 w-2 rounded-full', p.payment_type === 'refund' ? 'bg-red-400' : 'bg-green-400')} />
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {formatCurrency(p.amount)}
                              <span className="ml-1.5 text-xs font-normal text-gray-500 dark:text-gray-400">
                                {PAYMENT_TYPE_LABELS[p.payment_type] || p.payment_type}
                                {p.installment_number && ` #${p.installment_number}`}
                              </span>
                            </p>
                            <p className="text-[10px] text-gray-400">
                              {PAYMENT_METHODS.find(m => m.value === p.method)?.label} &bull; {new Date(p.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              {p.staff_name && ` \u00B7 ${p.staff_name}`}
                            </p>
                            {p.notes && <p className="text-[10px] text-gray-400 mt-0.5">{p.notes}</p>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Ek bilgiler */}
              <div className="space-y-2 text-sm">
                {selectedInvoice.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Ödeme Yöntemi</span>
                    <span className="text-gray-900 dark:text-gray-100">{PAYMENT_METHODS.find(m => m.value === selectedInvoice.payment_method)?.label}</span>
                  </div>
                )}
                {selectedInvoice.staff_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Personel</span>
                    <span className="text-gray-900 dark:text-gray-100">{selectedInvoice.staff_name}</span>
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

              {/* e-Fatura */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">e-Fatura</p>
                {selectedInvoice.efatura_id ? (
                  <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-medium text-green-700 dark:text-green-400">Gönderildi</p>
                      <p className="text-[10px] text-green-600 dark:text-green-500 mt-0.5">ID: {selectedInvoice.efatura_id}</p>
                    </div>
                    {selectedInvoice.efatura_pdf_url && (
                      <a href={selectedInvoice.efatura_pdf_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-green-700 dark:text-green-400 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />PDF
                      </a>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {efaturaError && (
                      <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{efaturaError}</p>
                    )}
                    <button
                      onClick={() => sendEfatura(selectedInvoice)}
                      disabled={efaturaSending}
                      className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-sm font-medium rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50"
                    >
                      {efaturaSending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      {efaturaSending ? 'Gönderiliyor...' : 'e-Fatura Gönder'}
                    </button>
                  </div>
                )}
              </div>

              {/* Aksiyonlar */}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                {(selectedInvoice.status === 'pending' || selectedInvoice.status === 'overdue') && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Hızlı Tam Ödeme</p>
                    <div className="grid grid-cols-2 gap-2">
                      {PAYMENT_METHODS.map(m => (
                        <button
                          key={m.value}
                          onClick={() => markAsPaid(selectedInvoice, m.value)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors"
                        >
                          <m.icon className="h-3.5 w-3.5" />
                          {m.label}
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
        </Portal>
      )}

      {/* Fatura Oluştur Modal */}
      {(showCreateModal || isClosingCreateModal) && (
        <Portal>
        <div className={`modal-overlay fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/70 p-4 ${isClosingCreateModal ? 'closing' : ''}`} onAnimationEnd={() => { if (isClosingCreateModal) { setShowCreateModal(false); setIsClosingCreateModal(false) } }}>
          <div className={`modal-content card w-full max-w-lg max-h-[90vh] overflow-y-auto dark:bg-gray-900 ${isClosingCreateModal ? 'closing' : ''}`}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Yeni Fatura Oluştur</h2>
              <button onClick={() => closeCreateModal()} className="text-gray-400 hover:text-gray-600"><X className="h-5 w-5" /></button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {/* Müşteri Seç */}
              <div>
                <label className="label">{customerLabel} (opsiyonel)</label>
                <CustomerSearchSelect
                  value={formCustomerId}
                  onChange={v => setFormCustomerId(v)}
                  businessId={businessId!}
                  placeholder={`— ${customerLabel} seçin —`}
                />
              </div>

              {/* Ödeme Tipi */}
              <div>
                <label className="label">Ödeme Tipi</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'standard' as const, label: 'Standart', desc: 'Tek seferde' },
                    { value: 'installment' as const, label: 'Taksitli', desc: 'Aylık ödemeler' },
                    { value: 'deposit' as const, label: 'Kaporalı', desc: 'Ön ödeme + kalan' },
                  ]).map(pt => (
                    <button
                      key={pt.value}
                      type="button"
                      onClick={() => setFormPaymentType(pt.value)}
                      className={cn('rounded-xl border p-3 text-left transition-all', formPaymentType === pt.value ? 'border-pulse-900 bg-pulse-50 dark:bg-pulse-900/20 ring-1 ring-pulse-900' : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600')}
                    >
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{pt.label}</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{pt.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Taksit Ayarları */}
              {formPaymentType === 'installment' && (
                <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Taksit Sayısı</label>
                      <CustomSelect
                        value={formInstallmentCount}
                        onChange={v => setFormInstallmentCount(v)}
                        options={[2,3,4,5,6,8,10,12].map(n => ({ value: String(n), label: `${n} Taksit` }))}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Sıklık</label>
                      <CustomSelect
                        value={formInstallmentFrequency}
                        onChange={v => setFormInstallmentFrequency(v as InstallmentFrequency)}
                        options={[
                          { value: 'weekly', label: 'Haftalık' },
                          { value: 'biweekly', label: '2 Haftalık' },
                          { value: 'monthly', label: 'Aylık' },
                        ]}
                      />
                    </div>
                  </div>
                  {formItems.some(i => i.total > 0) && (
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      <ChevronRight className="inline h-3 w-3" />
                      {parseInt(formInstallmentCount)} &times; {formatCurrency(formItems.reduce((s, i) => s + i.total, 0) / (parseInt(formInstallmentCount) || 1))}
                    </p>
                  )}
                </div>
              )}

              {/* Kapora Ayarları */}
              {formPaymentType === 'deposit' && (
                <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-900/10 p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Kapora Tutarı</label>
                      <input type="number" value={formDepositAmount} onChange={e => setFormDepositAmount(e.target.value)} className="input text-sm" placeholder="₺" min="0" step="0.01" />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 dark:text-gray-400 mb-0.5">Ödeme Yöntemi</label>
                      <CustomSelect
                        value={formDepositMethod}
                        onChange={v => setFormDepositMethod(v as PaymentMethod)}
                        options={PAYMENT_METHODS.map(m => ({ value: m.value, label: m.label }))}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Kalemler */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="label mb-0">Hizmet / Ürün Kalemleri</label>
                  <button type="button" onClick={addItem} className="text-xs text-pulse-900 dark:text-pulse-400 hover:underline flex items-center gap-1">
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
                <div className="mt-2 text-right text-sm text-gray-500 dark:text-gray-400">
                  Ara Toplam: <span className="font-medium text-gray-900 dark:text-gray-100">{formatCurrency(formItems.reduce((s, i) => s + i.total, 0))}</span>
                </div>
              </div>

              {/* İndirim */}
              <div>
                <label className="label">İndirim (opsiyonel)</label>
                <div className="flex gap-2">
                  <CustomSelect
                    value={formDiscountType}
                    onChange={v => setFormDiscountType(v as 'percentage' | 'fixed')}
                    options={[
                      { value: 'fixed', label: '₺ Tutar' },
                      { value: 'percentage', label: '% Oran' },
                    ]}
                    className="w-28"
                  />
                  <input
                    type="number"
                    value={formDiscountAmount}
                    onChange={e => setFormDiscountAmount(e.target.value)}
                    className="input flex-1"
                    placeholder={formDiscountType === 'percentage' ? 'Oran (ör: 10)' : 'Tutar (ör: 100)'}
                    min="0"
                    step="0.01"
                  />
                  <input
                    type="text"
                    value={formDiscountDescription}
                    onChange={e => setFormDiscountDescription(e.target.value)}
                    className="input flex-1"
                    placeholder="Açıklama (opsiyonel)"
                  />
                </div>
              </div>

              {/* KDV */}
              <div>
                <label className="label">KDV Oranı (%)</label>
                <div className="flex gap-2">
                  <CustomSelect
                    value={formTaxRate}
                    onChange={v => { setFormTaxRate(v); if (v !== 'custom') setFormCustomTaxRate('') }}
                    options={[
                      { value: '0', label: 'KDV Yok (%0)' },
                      { value: '1', label: '%1' },
                      { value: '8', label: '%8 (Sağlık)' },
                      { value: '10', label: '%10' },
                      { value: '20', label: '%20' },
                      { value: 'custom', label: 'Diğer' },
                    ]}
                    className={formTaxRate === 'custom' ? 'w-36' : 'w-full'}
                  />
                  {formTaxRate === 'custom' && (
                    <input
                      type="number"
                      value={formCustomTaxRate}
                      onChange={e => setFormCustomTaxRate(e.target.value)}
                      className="input flex-1"
                      placeholder="Oran girin (ör: 18)"
                      min="0"
                      max="100"
                      step="1"
                    />
                  )}
                </div>
              </div>

              {/* Vergi Bilgileri */}
              <details className="group">
                <summary className="label cursor-pointer flex items-center gap-1 select-none">
                  <ChevronRight className="h-4 w-4 transition-transform group-open:rotate-90" />
                  Vergi Bilgileri (opsiyonel)
                </summary>
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={formCompanyName}
                    onChange={e => setFormCompanyName(e.target.value)}
                    className="input"
                    placeholder="Firma Adı / Ünvanı"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={formTaxId}
                      onChange={e => setFormTaxId(e.target.value)}
                      className="input flex-1"
                      placeholder="VKN / TCKN"
                      maxLength={11}
                    />
                    <input
                      type="text"
                      value={formTaxOffice}
                      onChange={e => setFormTaxOffice(e.target.value)}
                      className="input flex-1"
                      placeholder="Vergi Dairesi"
                    />
                  </div>
                </div>
              </details>

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
                <button type="button" onClick={() => closeCreateModal()} className="btn-secondary flex-1">İptal</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Fatura Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}
    </div>
  )
}
