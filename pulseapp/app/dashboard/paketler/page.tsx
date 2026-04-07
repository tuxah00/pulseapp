'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { useDebounce } from '@/lib/hooks/use-debounce'
import {
  Plus, Package, Loader2, X, Pencil, Trash2, Search,
  ChevronRight, Clock, CheckCircle, XCircle, AlertTriangle,
  Users, Tag, Minus, LayoutList, LayoutGrid, CalendarPlus,
  Filter, ArrowUpDown,
} from 'lucide-react'
import { formatCurrency, formatDate, cn } from '@/lib/utils'
import { AnimatedList, AnimatedItem } from '@/components/ui/animated-list'
import { ToolbarPopover, SortPopoverContent } from '@/components/ui/toolbar-popover'
import { logAudit } from '@/lib/utils/audit'
import { useViewMode } from '@/lib/hooks/use-view-mode'
import CompactBoxCard from '@/components/ui/compact-box-card'
import type { ServicePackage, CustomerPackage, Service, PackageStatus, Customer, StaffMember } from '@/types'
import { CustomSelect } from '@/components/ui/custom-select'
import { Portal } from '@/components/ui/portal'

type PageTab = 'templates' | 'customer'
type StatusFilter = PackageStatus | 'all'

const STATUS_CONFIG: Record<PackageStatus, { label: string; color: string; icon: React.ElementType }> = {
  active: { label: 'Aktif', color: 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400', icon: CheckCircle },
  completed: { label: 'Tamamlandı', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400', icon: CheckCircle },
  cancelled: { label: 'İptal', color: 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400', icon: XCircle },
  expired: { label: 'Süresi Doldu', color: 'text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400', icon: AlertTriangle },
}

export default function PaketlerPage() {
  const { businessId, staffId, staffName, loading: ctxLoading, permissions } = useBusinessContext()
  const { confirm } = useConfirm()
  const supabase = createClient()
  const [viewMode, setViewMode] = useViewMode('paketler', 'list')

  const [pageTab, setPageTab] = useState<PageTab>('templates')

  // ── Templates state ──
  const [templates, setTemplates] = useState<ServicePackage[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [services, setServices] = useState<Service[]>([])

  // Template form
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<ServicePackage | null>(null)
  const [tName, setTName] = useState('')
  const [tDescription, setTDescription] = useState('')
  const [tServiceId, setTServiceId] = useState('')
  const [tSessions, setTSessions] = useState('10')
  const [tPrice, setTPrice] = useState('')
  const [tValidityDays, setTValidityDays] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [templateError, setTemplateError] = useState<string | null>(null)

  // ── Customer packages state ──
  const [customerPackages, setCustomerPackages] = useState<CustomerPackage[]>([])
  const [cpLoading, setCpLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebounce(search, 300)
  const [selectedCp, setSelectedCp] = useState<CustomerPackage | null>(null)
  const [sortField, setSortField] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  // Sell package form
  const [showSellModal, setShowSellModal] = useState(false)
  const [sTemplateId, setSTemplateId] = useState('')
  const [sCustomerName, setSCustomerName] = useState('')
  const [sCustomerPhone, setSCustomerPhone] = useState('')
  const [sPricePaid, setSPricePaid] = useState('')
  const [sNotes, setSNotes] = useState('')
  const [sPurchaseDate, setSPurchaseDate] = useState(new Date().toISOString().split('T')[0])
  const [sExpiryDate, setSExpiryDate] = useState('')
  const [savingSell, setSavingSell] = useState(false)
  const [sellError, setSellError] = useState<string | null>(null)
  const [sellCustomers, setSellCustomers] = useState<{id:string;name:string;phone:string|null}[]>([])
  const [sCustomerId, setSCustomerId] = useState('')
  const [sCreateCustomer, setSCreateCustomer] = useState(true)

  // Use session modal
  const [showUseModal, setShowUseModal] = useState(false)
  const [useNotes, setUseNotes] = useState('')
  const [savingUse, setSavingUse] = useState(false)

  // Create appointment from package modal
  const [showAptModal, setShowAptModal] = useState(false)
  const [aptDate, setAptDate] = useState('')
  const [aptTime, setAptTime] = useState('09:00')
  const [aptNotes, setAptNotes] = useState('')
  const [savingApt, setSavingApt] = useState(false)
  const [aptError, setAptError] = useState<string | null>(null)
  const [aptCustomers, setAptCustomers] = useState<Pick<Customer, 'id' | 'name'>[]>([])
  const [aptCustomerId, setAptCustomerId] = useState('')
  const [aptStaffMembers, setAptStaffMembers] = useState<Pick<StaffMember, 'id' | 'name'>[]>([])
  const [aptStaffId, setAptStaffId] = useState('')
  const [aptTemplateName, setAptTemplateName] = useState('')

  // ── Fetch templates ──
  const fetchTemplates = useCallback(async () => {
    if (!businessId) return
    setTemplatesLoading(true)
    const { data } = await supabase
      .from('service_packages')
      .select('*, service:services(name, duration_minutes)')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('sort_order')
      .order('created_at')
    setTemplates(data || [])
    setTemplatesLoading(false)
  }, [businessId])

  // ── Fetch services (for dropdowns) ──
  const fetchServices = useCallback(async () => {
    if (!businessId) return
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .order('name')
    setServices(data || [])
  }, [businessId])

  // ── Fetch customer packages ──
  const fetchCustomerPackages = useCallback(async () => {
    if (!businessId) return
    setCpLoading(true)
    const params = new URLSearchParams({ businessId, type: 'customer' })
    if (statusFilter !== 'all') params.set('status', statusFilter)
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim())

    const res = await fetch(`/api/packages?${params}`)
    const json = await res.json()
    setCustomerPackages(json.packages || [])
    setCpLoading(false)
  }, [businessId, statusFilter, debouncedSearch])

  useEffect(() => {
    if (ctxLoading) return
    fetchTemplates()
    fetchServices()
  }, [fetchTemplates, fetchServices, ctxLoading])

  useEffect(() => {
    if (ctxLoading || pageTab !== 'customer') return
    fetchCustomerPackages()
  }, [fetchCustomerPackages, ctxLoading, pageTab])

  // ── Template CRUD ──
  function openNewTemplate() {
    setEditingTemplate(null)
    setTName(''); setTDescription(''); setTServiceId('')
    setTSessions('10'); setTPrice(''); setTValidityDays('')
    setTemplateError(null); setShowTemplateModal(true)
  }

  function openEditTemplate(t: ServicePackage) {
    setEditingTemplate(t)
    setTName(t.name); setTDescription(t.description || '')
    setTServiceId(t.service_id || ''); setTSessions(String(t.sessions_total))
    setTPrice(String(t.price)); setTValidityDays(t.validity_days ? String(t.validity_days) : '')
    setTemplateError(null); setShowTemplateModal(true)
  }

  async function handleSaveTemplate(e: React.FormEvent) {
    e.preventDefault(); setSavingTemplate(true); setTemplateError(null)
    if (!tName.trim()) { setTemplateError('Paket adı zorunlu'); setSavingTemplate(false); return }

    const payload = {
      name: tName.trim(),
      description: tDescription.trim() || null,
      service_id: tServiceId || null,
      sessions_total: parseInt(tSessions) || 1,
      price: parseFloat(tPrice) || 0,
      validity_days: tValidityDays ? parseInt(tValidityDays) : null,
    }

    if (editingTemplate) {
      const { error } = await supabase.from('service_packages').update(payload).eq('id', editingTemplate.id)
      if (error) { setTemplateError(error.message); setSavingTemplate(false); return }
      await logAudit({ businessId: businessId!, staffId, staffName, action: 'update', resource: 'service_packages', resourceId: editingTemplate.id, details: { name: payload.name } })
    } else {
      const { error } = await supabase.from('service_packages').insert({ ...payload, business_id: businessId })
      if (error) { setTemplateError(error.message); setSavingTemplate(false); return }
      await logAudit({ businessId: businessId!, staffId, staffName, action: 'create', resource: 'service_packages', details: { name: payload.name } })
    }

    setSavingTemplate(false); setShowTemplateModal(false); fetchTemplates()
  }

  async function handleDeleteTemplate(t: ServicePackage) {
    const ok = await confirm({ title: 'Paketi sil', message: `"${t.name}" paket şablonunu silmek istiyor musunuz?`, confirmText: 'Sil', variant: 'danger' })
    if (!ok) return
    await supabase.from('service_packages').update({ is_active: false }).eq('id', t.id)
    await logAudit({ businessId: businessId!, staffId, staffName, action: 'delete', resource: 'service_packages', resourceId: t.id, details: { name: t.name } })
    fetchTemplates()
  }

  // ── Sell package ──
  async function openSellModal(templateId?: string) {
    setSTemplateId(templateId ?? templates[0]?.id ?? '')
    setSCustomerName(''); setSCustomerPhone(''); setSPricePaid('')
    setSNotes(''); setSPurchaseDate(new Date().toISOString().split('T')[0]); setSExpiryDate('')
    setSellError(null); setSCustomerId(''); setSellCustomers([]); setSCreateCustomer(true)
    // Fetch customers for dropdown
    const { data } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('business_id', businessId!)
      .eq('is_active', true)
      .order('name')
    setSellCustomers((data || []) as {id:string;name:string;phone:string|null}[])
    setShowSellModal(true)
  }

  useEffect(() => {
    if (!sTemplateId) return
    const tmpl = templates.find(t => t.id === sTemplateId)
    if (tmpl) {
      setSPricePaid(String(tmpl.price))
      if (tmpl.validity_days) {
        const d = new Date()
        d.setDate(d.getDate() + tmpl.validity_days)
        setSExpiryDate(d.toISOString().split('T')[0])
      } else {
        setSExpiryDate('')
      }
    }
  }, [sTemplateId, templates])

  async function handleSellPackage(e: React.FormEvent) {
    e.preventDefault(); setSavingSell(true); setSellError(null)
    if (!sCustomerName.trim()) { setSellError('Müşteri adı zorunlu'); setSavingSell(false); return }
    if (!sTemplateId) { setSellError('Paket şablonu seçin'); setSavingSell(false); return }

    const tmpl = templates.find(t => t.id === sTemplateId)!
    const payload = {
      business_id: businessId,
      package_id: tmpl.id,
      customer_name: sCustomerName.trim(),
      customer_phone: sCustomerPhone.trim() || null,
      package_name: tmpl.name,
      service_id: tmpl.service_id || null,
      sessions_total: tmpl.sessions_total,
      sessions_used: 0,
      price_paid: parseFloat(sPricePaid) || 0,
      status: 'active',
      purchase_date: sPurchaseDate,
      expiry_date: sExpiryDate || null,
      notes: sNotes.trim() || null,
      staff_id: staffId || null,
    }

    const { error } = await supabase.from('customer_packages').insert(payload)
    if (error) { setSellError(error.message); setSavingSell(false); return }

    // Yeni müşteri olarak kaydet (dropdown'dan seçilmediyse ve checkbox aktifse)
    if (sCreateCustomer && !sCustomerId && sCustomerName.trim()) {
      await supabase.from('customers').insert({
        business_id: businessId,
        name: sCustomerName.trim(),
        phone: sCustomerPhone.trim().replace(/\s/g, '') || null,
        segment: 'new',
        is_active: true,
      })
    }

    await logAudit({ businessId: businessId!, staffId, staffName, action: 'create', resource: 'customer_packages', details: { customer_name: payload.customer_name, package_name: payload.package_name } })
    setSavingSell(false); setShowSellModal(false); setPageTab('customer'); fetchCustomerPackages()
  }

  // ── Use session ──
  function openUseModal(cp: CustomerPackage) {
    setSelectedCp(cp); setUseNotes(''); setShowUseModal(true)
  }

  async function handleUseSession(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCp) return
    setSavingUse(true)

    const newUsed = selectedCp.sessions_used + 1
    const newStatus: PackageStatus = newUsed >= selectedCp.sessions_total ? 'completed' : 'active'

    const { error } = await supabase
      .from('customer_packages')
      .update({ sessions_used: newUsed, status: newStatus })
      .eq('id', selectedCp.id)

    if (error) { setSavingUse(false); return }

    // Log usage record
    await supabase.from('package_usages').insert({
      business_id: businessId,
      customer_package_id: selectedCp.id,
      notes: useNotes.trim() || null,
      staff_id: staffId || null,
    })

    await logAudit({ businessId: businessId!, staffId, staffName, action: 'update', resource: 'customer_packages', resourceId: selectedCp.id, details: { action: 'use_session', sessions_used: newUsed } })
    setSavingUse(false); setShowUseModal(false)
    setSelectedCp(prev => prev ? { ...prev, sessions_used: newUsed, status: newStatus } : null)
    fetchCustomerPackages()
  }

  function closePanel() {
    setSelectedCp(null)
  }

  async function openAptModal(cp: CustomerPackage) {
    setAptDate(new Date().toISOString().split('T')[0])
    setAptTime('09:00'); setAptNotes(''); setAptError(null); setAptTemplateName('')
    // Fetch customers and staff for dropdowns
    const [custRes, staffRes] = await Promise.all([
      supabase.from('customers').select('id, name').eq('business_id', businessId!).eq('is_active', true).order('name'),
      supabase.from('staff_members').select('id, name').eq('business_id', businessId!).eq('is_active', true).order('name'),
    ])
    setAptCustomers(custRes.data || [])
    setAptStaffMembers(staffRes.data || [])
    // Pre-select customer if found by name
    const matchedCust = (custRes.data || []).find((c: Pick<Customer, 'id' | 'name'>) => c.name.toLowerCase() === cp.customer_name.toLowerCase())
    setAptCustomerId(matchedCust?.id || '')
    setAptStaffId('')
    setSelectedCp(cp)
    setShowAptModal(true)
  }

  async function openAptModalFromTemplate(t: ServicePackage) {
    setAptDate(new Date().toISOString().split('T')[0])
    setAptTime('09:00'); setAptNotes(''); setAptError(null)
    setAptTemplateName(t.name)
    // Fetch customers and staff for dropdowns
    const [custRes, staffRes] = await Promise.all([
      supabase.from('customers').select('id, name').eq('business_id', businessId!).eq('is_active', true).order('name'),
      supabase.from('staff_members').select('id, name').eq('business_id', businessId!).eq('is_active', true).order('name'),
    ])
    setAptCustomers(custRes.data || [])
    setAptStaffMembers(staffRes.data || [])
    setAptCustomerId('')
    setAptStaffId('')
    setSelectedCp(null)
    setShowAptModal(true)
  }

  function calculateEndTime(start: string, durationMin: number): string {
    const [h, m] = start.split(':').map(Number)
    const t = h * 60 + m + durationMin
    return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
  }

  async function handleCreateApt(e: React.FormEvent) {
    e.preventDefault()
    if (!aptDate) return
    setSavingApt(true); setAptError(null)

    const notesFallback = selectedCp ? `Paket: ${selectedCp.package_name}` : (aptTemplateName ? `Şablon: ${aptTemplateName}` : '')
    const linkedService = services.find(s => s.id === (selectedCp?.service_id || null))
    const duration = linkedService?.duration_minutes || 30
    const endTime = calculateEndTime(aptTime, duration)

    const { error } = await supabase.from('appointments').insert({
      business_id: businessId,
      customer_id: aptCustomerId || null,
      service_id: selectedCp?.service_id || null,
      staff_id: aptStaffId || null,
      appointment_date: aptDate,
      start_time: aptTime,
      end_time: endTime,
      status: 'confirmed',
      notes: aptNotes.trim() || notesFallback || null,
    })

    if (error) { setAptError(error.message); setSavingApt(false); return }

    await logAudit({ businessId: businessId!, staffId, staffName, action: 'create', resource: 'appointment', details: { package_name: selectedCp?.package_name || aptTemplateName } })
    setSavingApt(false); setShowAptModal(false)
  }

  if (ctxLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-pulse-900" />
      </div>
    )
  }

  const activeTemplate = templates.find(t => t.id === sTemplateId)

  const sortedPackages = sortField
    ? [...customerPackages].sort((a, b) => {
        const va = (a as any)[sortField]
        const vb = (b as any)[sortField]
        if (va == null && vb == null) return 0
        if (va == null) return 1
        if (vb == null) return -1
        const cmp = typeof va === 'string' ? va.localeCompare(vb, 'tr') : (va as number) - (vb as number)
        return sortDir === 'asc' ? cmp : -cmp
      })
    : customerPackages

  return (
    <div className="space-y-6 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">Paket & Seans Yönetimi</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Paket şablonları oluştur, müşterilere sat ve seans düşümü yap</p>
        </div>
        <div className="flex items-center gap-2">
          {pageTab === 'customer' && (
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <ToolbarPopover icon={<Filter className="h-4 w-4" />} label="Filtre" active={statusFilter !== 'all'}>
                <div className="p-3 w-52 space-y-1">
                  <p className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Durum</p>
                  {(['all', 'active', 'completed', 'expired', 'cancelled'] as StatusFilter[]).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', statusFilter === s ? 'bg-pulse-50 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-300 font-medium' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700')}>
                      {s === 'all' ? 'Tümü' : STATUS_CONFIG[s as PackageStatus].label}
                    </button>
                  ))}
                </div>
              </ToolbarPopover>
              <ToolbarPopover icon={<ArrowUpDown className="h-4 w-4" />} label="Sırala" active={sortField !== null}>
                <SortPopoverContent
                  options={[
                    { value: 'customer_name', label: 'Müşteri adı' },
                    { value: 'sessions_used', label: 'Seans kullanımı' },
                    { value: 'purchase_date', label: 'Satın alma tarihi' },
                    { value: 'status', label: 'Durum' },
                  ]}
                  sortField={sortField} sortDir={sortDir} onSortField={setSortField} onSortDir={setSortDir}
                />
              </ToolbarPopover>
              <div className="w-px h-5 bg-gray-300 dark:bg-gray-600 mx-0.5" />
              <button onClick={() => setViewMode('list')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'list' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Liste"><LayoutList className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('box')} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors', viewMode === 'box' ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700')} title="Kutular"><LayoutGrid className="h-4 w-4" /></button>
            </div>
          )}
          {pageTab === 'templates' && permissions?.packages && (
            <button onClick={openNewTemplate} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Yeni Paket Şablonu
            </button>
          )}
          {pageTab === 'customer' && permissions?.packages && templates.length > 0 && (
            <button onClick={() => openSellModal()} className="btn-primary flex items-center gap-2">
              <Plus className="h-4 w-4" /> Paket Sat
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        <nav className="flex gap-1 whitespace-nowrap -mb-px">
          {([
            { key: 'templates', label: 'Paket Şablonları', count: templates.length },
            { key: 'customer', label: 'Müşteri Paketleri' },
          ] as { key: PageTab; label: string; count?: number }[]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setPageTab(tab.key)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors',
                pageTab === tab.key
                  ? 'border-pulse-900 text-pulse-900 dark:text-pulse-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className="ml-2 rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* ── TEMPLATES TAB ── */}
      {pageTab === 'templates' && (
        <div>
          {templatesLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
          ) : templates.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Package className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
              <p className="font-medium text-gray-900 dark:text-gray-100">Henüz paket şablonu yok</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-4">Müşterilere satmak için paket tanımlayın</p>
              <button onClick={openNewTemplate} className="btn-primary flex items-center gap-2">
                <Plus className="h-4 w-4" /> Yeni Paket Şablonu
              </button>
            </div>
          ) : (
            <AnimatedList className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {templates.map(t => (
                <AnimatedItem key={t.id}>
                  <div className="card p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-pulse-50 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-400 flex-shrink-0">
                          <Package className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate">{t.name}</p>
                          {t.service && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{t.service.name}</p>
                          )}
                        </div>
                      </div>
                      {permissions?.packages && (
                        <div className="flex gap-1 flex-shrink-0 ml-2">
                          <button onClick={() => openEditTemplate(t)} className="rounded p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDeleteTemplate(t)} className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {t.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 line-clamp-2">{t.description}</p>
                    )}

                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                          <Tag className="h-4 w-4 text-gray-400" />
                          {t.sessions_total} seans
                        </span>
                        {t.validity_days && (
                          <span className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
                            <Clock className="h-3.5 w-3.5" />
                            {t.validity_days} gün
                          </span>
                        )}
                      </div>
                      <span className="text-lg font-bold text-pulse-900 dark:text-pulse-400">{formatCurrency(t.price)}</span>
                    </div>

                    <button
                      onClick={() => openSellModal(t.id)}
                      className="mt-4 w-full text-sm font-medium text-center py-2 rounded-lg border border-pulse-200 dark:border-pulse-800 text-pulse-900 dark:text-pulse-400 hover:bg-pulse-50 dark:hover:bg-pulse-900/20 transition-colors"
                    >
                      Bu Paketi Sat
                    </button>
                    <button
                      onClick={() => openAptModalFromTemplate(t)}
                      className="mt-2 w-full text-sm font-medium text-center py-2 rounded-lg border border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <CalendarPlus className="h-4 w-4" /> Randevu Oluştur
                    </button>
                  </div>
                </AnimatedItem>
              ))}
            </AnimatedList>
          )}
        </div>
      )}

      {/* ── CUSTOMER PACKAGES TAB ── */}
      {pageTab === 'customer' && (
        <div className="flex gap-4 items-start">
          <div className="flex-1 min-w-0 space-y-4">
            {/* Arama */}
            <div className="relative max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Müşteri ara..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input pl-9 text-sm w-full"
              />
            </div>

            {/* List / Box */}
            {cpLoading ? (
              <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
            ) : customerPackages.length === 0 ? (
              <div className="card flex flex-col items-center justify-center py-16 text-center">
                <Users className="h-12 w-12 text-gray-300 dark:text-gray-600 mb-3" />
                <p className="font-medium text-gray-900 dark:text-gray-100">Müşteri paketi bulunamadı</p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {templates.length === 0 ? 'Önce paket şablonu oluşturun' : 'Paket satmak için "Paket Sat" butonunu kullanın'}
                </p>
              </div>
            ) : viewMode === 'box' ? (
              <AnimatedList className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2">
                {sortedPackages.map(cp => {
                  const cfg = STATUS_CONFIG[cp.status]
                  return (
                    <AnimatedItem key={cp.id}>
                      <CompactBoxCard
                        initials={cp.customer_name.slice(0, 2).toUpperCase()}
                        title={cp.customer_name}
                        colorClass="bg-pulse-100 text-pulse-900 dark:bg-pulse-900/30 dark:text-pulse-400"
                        badge={<span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', cfg.color)}>{cfg.label}</span>}
                        meta={`${cp.sessions_used}/${cp.sessions_total} seans`}
                        selected={selectedCp?.id === cp.id}
                        onClick={() => setSelectedCp(selectedCp?.id === cp.id ? null : cp)}
                      />
                    </AnimatedItem>
                  )
                })}
              </AnimatedList>
            ) : (
              <AnimatedList className="space-y-2">
                {sortedPackages.map(cp => {
                  const pct = Math.round((cp.sessions_used / cp.sessions_total) * 100)
                  const remaining = cp.sessions_total - cp.sessions_used
                  const cfg = STATUS_CONFIG[cp.status]
                  const StatusIcon = cfg.icon
                  const isSelected = selectedCp?.id === cp.id

                  return (
                    <AnimatedItem key={cp.id}>
                      <div
                        className={cn(
                          'card cursor-pointer hover:shadow-md transition-all',
                          isSelected && 'ring-2 ring-pulse-900'
                        )}
                        onClick={() => setSelectedCp(isSelected ? null : cp)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Avatar */}
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pulse-100 dark:bg-pulse-900/30 text-pulse-900 dark:text-pulse-400 font-bold text-sm flex-shrink-0">
                            {cp.customer_name.slice(0, 2).toUpperCase()}
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{cp.customer_name}</span>
                              <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', cfg.color)}>
                                <StatusIcon className="h-3 w-3" />
                                {cfg.label}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-300 truncate">{cp.package_name}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <div className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-full h-1.5 max-w-[120px]">
                                <div
                                  className={cn('h-1.5 rounded-full transition-all', cp.status === 'completed' ? 'bg-blue-500' : 'bg-pulse-900')}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {cp.sessions_used}/{cp.sessions_total} seans
                              </span>
                              {remaining > 0 && cp.status === 'active' && (
                                <span className="text-xs text-green-600 dark:text-green-400 font-medium">{remaining} kaldı</span>
                              )}
                            </div>
                          </div>

                          {/* Right side */}
                          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(cp.price_paid)}</span>
                            <span className="text-xs text-gray-400">{formatDate(cp.purchase_date)}</span>
                            {cp.expiry_date && (
                              <span className="text-xs text-orange-500">
                                Bitiş: {formatDate(cp.expiry_date)}
                              </span>
                            )}
                          </div>

                          <ChevronRight className={cn('h-4 w-4 text-gray-400 transition-transform flex-shrink-0', isSelected && 'rotate-90')} />
                        </div>
                      </div>
                    </AnimatedItem>
                  )
                })}
              </AnimatedList>
            )}
          </div>

          {/* ── Detail Panel ── */}
          {selectedCp && (() => {
            const detailPct = Math.round((selectedCp.sessions_used / selectedCp.sessions_total) * 100)
            return (
            <div className="w-80 flex-shrink-0 card space-y-4 transition-all duration-200">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{selectedCp.customer_name}</h3>
                <button onClick={closePanel} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Paket</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-right truncate max-w-[180px]">{selectedCp.package_name}</span>
                </div>
                {selectedCp.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Telefon</span>
                    <span className="text-gray-900 dark:text-gray-100">{selectedCp.customer_phone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Durum</span>
                  <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', STATUS_CONFIG[selectedCp.status].color)}>
                    {STATUS_CONFIG[selectedCp.status].label}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Seans</span>
                  <span className="font-medium text-gray-900 dark:text-gray-100">{selectedCp.sessions_used} / {selectedCp.sessions_total}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Ödenen</span>
                  <span className="font-semibold text-pulse-900 dark:text-pulse-400">{formatCurrency(selectedCp.price_paid)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500 dark:text-gray-400">Satın Alım</span>
                  <span className="text-gray-900 dark:text-gray-100">{formatDate(selectedCp.purchase_date)}</span>
                </div>
                {selectedCp.expiry_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-gray-400">Bitiş</span>
                    <span className="text-orange-500">{formatDate(selectedCp.expiry_date)}</span>
                  </div>
                )}
                {selectedCp.notes && (
                  <div className="pt-1 border-t border-gray-100 dark:border-gray-800">
                    <p className="text-xs text-gray-500 dark:text-gray-400">{selectedCp.notes}</p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
                  <span>İlerleme</span>
                  <span>{detailPct}%</span>
                </div>
                <div className="bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                  <div
                    className={cn('h-2 rounded-full transition-all', selectedCp.status === 'completed' ? 'bg-blue-500' : 'bg-pulse-900')}
                    style={{ width: `${detailPct}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  {selectedCp.sessions_total - selectedCp.sessions_used} seans kaldı
                </p>
              </div>

              {/* Actions */}
              {selectedCp.status === 'active' && permissions?.packages && (
                <button
                  onClick={() => openUseModal(selectedCp)}
                  className="w-full btn-primary flex items-center justify-center gap-2"
                >
                  <Minus className="h-4 w-4" /> Seans Düş
                </button>
              )}

              {selectedCp.status === 'active' && (
                <button
                  onClick={() => openAptModal(selectedCp)}
                  className="w-full btn-secondary flex items-center justify-center gap-2 text-sm"
                >
                  <CalendarPlus className="h-4 w-4" /> Randevu Oluştur
                </button>
              )}

              {selectedCp.status === 'active' && permissions?.packages && (
                <button
                  onClick={async () => {
                    const ok = await confirm({ title: 'Paketi iptal et', message: 'Bu müşteri paketini iptal etmek istiyor musunuz?', confirmText: 'İptal Et', variant: 'danger' })
                    if (!ok) return
                    await supabase.from('customer_packages').update({ status: 'cancelled' }).eq('id', selectedCp.id)
                    setSelectedCp(prev => prev ? { ...prev, status: 'cancelled' } : null)
                    fetchCustomerPackages()
                  }}
                  className="w-full text-sm text-red-500 hover:text-red-600 py-1.5 text-center hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  Paketi İptal Et
                </button>
              )}
            </div>
          )
          })()}
        </div>
      )}

      {/* ── Template Modal ── */}
      {showTemplateModal && (
        <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70">
          <div className="w-full max-w-md card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingTemplate ? 'Paketi Düzenle' : 'Yeni Paket Şablonu'}
              </h2>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paket Adı *</label>
                <input
                  type="text"
                  value={tName}
                  onChange={e => setTName(e.target.value)}
                  placeholder="10 Seans Epilasyon Paketi"
                  className="input w-full text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hizmet (opsiyonel)</label>
                <CustomSelect
                  options={services.map(s => ({ value: s.id, label: s.name }))}
                  value={tServiceId}
                  onChange={v => setTServiceId(v)}
                  placeholder="— Seçin —"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Seans Sayısı *</label>
                  <input
                    type="number"
                    min={1}
                    value={tSessions}
                    onChange={e => setTSessions(e.target.value)}
                    className="input w-full text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Fiyat (₺) *</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={tPrice}
                    onChange={e => setTPrice(e.target.value)}
                    placeholder="0.00"
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Geçerlilik (gün, opsiyonel)</label>
                <input
                  type="number"
                  min={1}
                  value={tValidityDays}
                  onChange={e => setTValidityDays(e.target.value)}
                  placeholder="Boş bırakın = süresiz"
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Açıklama</label>
                <textarea
                  value={tDescription}
                  onChange={e => setTDescription(e.target.value)}
                  rows={2}
                  className="input w-full text-sm resize-none"
                  placeholder="Paket detayları..."
                />
              </div>

              {templateError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{templateError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowTemplateModal(false)} className="flex-1 btn-secondary text-sm">
                  İptal
                </button>
                <button type="submit" disabled={savingTemplate} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                  {savingTemplate && <Loader2 className="h-4 w-4 animate-spin" />}
                  {editingTemplate ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* ── Sell Package Modal ── */}
      {showSellModal && (
        <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70">
          <div className="w-full max-w-md card space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Paket Sat</h2>
              <button onClick={() => setShowSellModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSellPackage} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paket Şablonu *</label>
                <CustomSelect
                  options={templates.map(t => ({ value: t.id, label: `${t.name} — ${t.sessions_total} seans — ${formatCurrency(t.price)}` }))}
                  value={sTemplateId}
                  onChange={v => setSTemplateId(v)}
                  placeholder="— Seçin —"
                />
              </div>

              {activeTemplate && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-pulse-50 dark:bg-pulse-900/20 text-xs text-pulse-900 dark:text-pulse-300">
                  <Package className="h-3.5 w-3.5 flex-shrink-0" />
                  {activeTemplate.sessions_total} seans
                  {activeTemplate.validity_days && ` · ${activeTemplate.validity_days} gün geçerli`}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Müşteri Seç</label>
                <CustomSelect
                  options={sellCustomers.map(c => ({ value: c.id, label: `${c.name}${c.phone ? ` — ${c.phone}` : ''}` }))}
                  value={sCustomerId}
                  onChange={id => {
                    setSCustomerId(id)
                    if (id) {
                      const found = sellCustomers.find(c => c.id === id)
                      if (found) {
                        setSCustomerName(found.name)
                        setSCustomerPhone(found.phone || '')
                      }
                    } else {
                      setSCustomerName('')
                      setSCustomerPhone('')
                    }
                  }}
                  placeholder="— Müşteri Seç —"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">veya Ad Soyad yazın *</label>
                <input
                  type="text"
                  value={sCustomerName}
                  onChange={e => { setSCustomerId(''); setSCustomerName(e.target.value) }}
                  placeholder="Ad Soyad"
                  className="input w-full text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefon</label>
                <input
                  type="tel"
                  value={sCustomerPhone}
                  onChange={e => setSCustomerPhone(e.target.value)}
                  placeholder="05xx xxx xx xx"
                  className="input w-full text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ödenen Tutar (₺)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={sPricePaid}
                    onChange={e => setSPricePaid(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Satın Alım Tarihi</label>
                  <input
                    type="date"
                    value={sPurchaseDate}
                    onChange={e => setSPurchaseDate(e.target.value)}
                    className="input w-full text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bitiş Tarihi (opsiyonel)</label>
                <input
                  type="date"
                  value={sExpiryDate}
                  onChange={e => setSExpiryDate(e.target.value)}
                  className="input w-full text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notlar</label>
                <textarea
                  value={sNotes}
                  onChange={e => setSNotes(e.target.value)}
                  rows={2}
                  className="input w-full text-sm resize-none"
                  placeholder="Opsiyonel notlar..."
                />
              </div>

              {!sCustomerId && (
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={sCreateCustomer}
                    onChange={e => setSCreateCustomer(e.target.checked)}
                    className="h-4 w-4 accent-pulse-900"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Yeni müşteri olarak ekle</span>
                </label>
              )}

              {sellError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-2">{sellError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSellModal(false)} className="flex-1 btn-secondary text-sm">
                  İptal
                </button>
                <button type="submit" disabled={savingSell} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                  {savingSell && <Loader2 className="h-4 w-4 animate-spin" />}
                  Paketi Sat
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* ── Use Session Modal ── */}
      {showUseModal && selectedCp && (
        <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70">
          <div className="w-full max-w-sm card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Seans Düş</h2>
              <button onClick={() => setShowUseModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 space-y-1 text-sm">
              <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCp.customer_name}</p>
              <p className="text-gray-500 dark:text-gray-400">{selectedCp.package_name}</p>
              <p className="text-pulse-900 dark:text-pulse-400 font-medium">
                {selectedCp.sessions_used} / {selectedCp.sessions_total} seans kullanıldı →{' '}
                <span className="text-green-600 dark:text-green-400">{selectedCp.sessions_used + 1} / {selectedCp.sessions_total}</span>
              </p>
            </div>

            <form onSubmit={handleUseSession} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Not (opsiyonel)</label>
                <input
                  type="text"
                  value={useNotes}
                  onChange={e => setUseNotes(e.target.value)}
                  placeholder="Seans notu..."
                  className="input w-full text-sm"
                />
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowUseModal(false)} className="flex-1 btn-secondary text-sm">
                  İptal
                </button>
                <button type="submit" disabled={savingUse} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                  {savingUse && <Loader2 className="h-4 w-4 animate-spin" />}
                  Seans Düş
                </button>
              </div>
            </form>
          </div>
        </div>
        </Portal>
      )}

      {/* ── Randevu Oluştur Modal ── */}
      {showAptModal && (
        <Portal>
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 dark:bg-black/70">
          <div className="w-full max-w-sm card space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {selectedCp
                  ? `${selectedCp.customer_name} — Randevu Oluştur`
                  : aptTemplateName
                    ? `${aptTemplateName} için Randevu Oluştur`
                    : 'Randevu Oluştur'}
              </h2>
              <button onClick={() => setShowAptModal(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400">
                <X className="h-5 w-5" />
              </button>
            </div>

            {selectedCp && (
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">{selectedCp.customer_name}</p>
                <p className="text-gray-500 dark:text-gray-400">{selectedCp.package_name}</p>
              </div>
            )}

            <form onSubmit={handleCreateApt} className="space-y-3">
              {aptCustomers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Müşteri</label>
                  <CustomSelect
                    options={aptCustomers.map(c => ({ value: c.id, label: c.name }))}
                    value={aptCustomerId}
                    onChange={v => setAptCustomerId(v)}
                    placeholder="— Seçin —"
                  />
                </div>
              )}

              {aptStaffMembers.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Personel (opsiyonel)</label>
                  <CustomSelect
                    options={aptStaffMembers.map(s => ({ value: s.id, label: s.name }))}
                    value={aptStaffId}
                    onChange={v => setAptStaffId(v)}
                    placeholder="— Seçin —"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tarih</label>
                  <input type="date" value={aptDate} onChange={e => setAptDate(e.target.value)} className="input w-full text-sm" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Saat</label>
                  <input type="time" value={aptTime} onChange={e => setAptTime(e.target.value)} className="input w-full text-sm" required />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Not (opsiyonel)</label>
                <input type="text" value={aptNotes} onChange={e => setAptNotes(e.target.value)} placeholder="Randevu notu..." className="input w-full text-sm" />
              </div>

              {aptError && <p className="text-sm text-red-600">{aptError}</p>}

              <div className="flex gap-2">
                <button type="button" onClick={() => setShowAptModal(false)} className="flex-1 btn-secondary text-sm">İptal</button>
                <button type="submit" disabled={savingApt} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                  {savingApt && <Loader2 className="h-4 w-4 animate-spin" />}
                  Randevu Oluştur
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
