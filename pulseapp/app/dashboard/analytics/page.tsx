'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { logAudit } from '@/lib/utils/audit'
import {
  Loader2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, AlertTriangle, Clock, Star, UserCheck, Minus,
  BarChart3, PieChart, Activity, Plus, X, Wallet, Download,
} from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { SEGMENT_LABELS } from '@/types'
import { exportToCSV } from '@/lib/utils/export'
import type { Expense, Income } from '@/types'

function getPeriodDates(period: 'week' | 'month' | 'year', offset = 0): { start: string; end: string } {
  const now = new Date()
  let start: Date
  let end: Date

  if (period === 'week') {
    const days = 7 * (offset + 1)
    const daysBack = 7 * offset
    start = new Date(now); start.setDate(now.getDate() - days)
    end = new Date(now); end.setDate(now.getDate() - daysBack)
  } else if (period === 'month') {
    const months = offset + 1
    const monthsBack = offset
    start = new Date(now); start.setMonth(now.getMonth() - months)
    end = new Date(now); end.setMonth(now.getMonth() - monthsBack)
  } else {
    const years = offset + 1
    const yearsBack = offset
    start = new Date(now); start.setFullYear(now.getFullYear() - years)
    end = new Date(now); end.setFullYear(now.getFullYear() - yearsBack)
  }

  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  }
}

export default function AnalyticsPage() {
  const { businessId, staffId, staffName, loading: ctxLoading, permissions } = useBusinessContext()
  const { confirm } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [activeTab, setActiveTab] = useState<'overview' | 'staff' | 'customers' | 'sources' | 'expenses'>('overview')

  const [appointments, setAppointments] = useState<any[]>([])
  const [prevAppointments, setPrevAppointments] = useState<any[]>([])
  const [customers, setCustomers] = useState<any[]>([])
  const [reviews, setReviews] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])
  const [staffMembers, setStaffMembers] = useState<any[]>([])
  const [paidInvoices, setPaidInvoices] = useState<any[]>([])

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expCategory, setExpCategory] = useState('')
  const [expDescription, setExpDescription] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0])
  const [expIsRecurring, setExpIsRecurring] = useState(false)
  const [expRecurringPeriod, setExpRecurringPeriod] = useState('monthly')
  const [savingExpense, setSavingExpense] = useState(false)

  // Income state
  const [incomes, setIncomes] = useState<Income[]>([])
  const [incomesLoading, setIncomesLoading] = useState(false)
  const [showIncomeForm, setShowIncomeForm] = useState(false)
  const [incCategory, setIncCategory] = useState('')
  const [incDescription, setIncDescription] = useState('')
  const [incAmount, setIncAmount] = useState('')
  const [incDate, setIncDate] = useState(() => new Date().toISOString().split('T')[0])
  const [incIsRecurring, setIncIsRecurring] = useState(false)
  const [incRecurringPeriod, setIncRecurringPeriod] = useState('monthly')
  const [incCustomDays, setIncCustomDays] = useState('7')
  const [savingIncome, setSavingIncome] = useState(false)

  // Custom interval for expenses too
  const [expCustomDays, setExpCustomDays] = useState('7')

  const supabase = createClient()

  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const { start, end } = getPeriodDates(period, 0)
    const { start: prevStart, end: prevEnd } = getPeriodDates(period, 1)

    const [aptRes, prevAptRes, custRes, revRes, svcRes, staffRes, invRes] = await Promise.all([
      supabase.from('appointments').select('*, services(name, price)')
        .eq('business_id', businessId).gte('appointment_date', start).lte('appointment_date', end).order('appointment_date'),
      supabase.from('appointments').select('status, services(price)')
        .eq('business_id', businessId).gte('appointment_date', prevStart).lte('appointment_date', prevEnd),
      supabase.from('customers').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('reviews').select('*').eq('business_id', businessId).gte('created_at', start + 'T00:00:00'),
      supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
      supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true),
      // Ödenen faturalar (dönem filtresine göre)
      supabase.from('invoices').select('id, total, appointment_id, paid_at, created_at')
        .eq('business_id', businessId).eq('status', 'paid')
        .gte('paid_at', start + 'T00:00:00').lte('paid_at', end + 'T23:59:59'),
    ])

    if (aptRes.data) setAppointments(aptRes.data)
    if (prevAptRes.data) setPrevAppointments(prevAptRes.data)
    if (custRes.data) setCustomers(custRes.data)
    if (revRes.data) setReviews(revRes.data)
    if (svcRes.data) setServices(svcRes.data)
    if (staffRes.data) setStaffMembers(staffRes.data)
    if (invRes.data) setPaidInvoices(invRes.data)
    setLoading(false)
  }, [businessId, period])

  const fetchExpenses = useCallback(async () => {
    if (!businessId) return
    setExpensesLoading(true)
    const { start, end } = getPeriodDates(period, 0)
    const res = await fetch(`/api/expenses?businessId=${businessId}&from=${start}&to=${end}`)
    const json = await res.json()
    setExpenses(json.expenses || [])
    setExpensesLoading(false)
  }, [businessId, period])

  const fetchIncome = useCallback(async () => {
    if (!businessId) return
    setIncomesLoading(true)
    const { start, end } = getPeriodDates(period, 0)
    const res = await fetch(`/api/income?businessId=${businessId}&from=${start}&to=${end}`)
    const json = await res.json()
    setIncomes(json.income || [])
    setIncomesLoading(false)
  }, [businessId, period])

  useEffect(() => {
    if (activeTab === 'expenses' && businessId) {
      fetchExpenses()
      fetchIncome()
    }
  }, [activeTab, fetchExpenses, fetchIncome, businessId])

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!expCategory || !expAmount || !expDate) return
    setSavingExpense(true)
    try {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          category: expCategory,
          description: expDescription || null,
          amount: parseFloat(expAmount),
          expense_date: expDate,
          is_recurring: expIsRecurring,
          recurring_period: expIsRecurring ? expRecurringPeriod : null,
          custom_interval_days: expIsRecurring && expRecurringPeriod === 'custom' ? parseInt(expCustomDays) || null : null,
        }),
      })
      setShowExpenseForm(false)
      logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'create', resource: 'expense', details: { category: expCategory, amount: parseFloat(expAmount), description: expDescription || null } })
      setExpCategory(''); setExpDescription(''); setExpAmount('')
      setExpDate(new Date().toISOString().split('T')[0])
      setExpIsRecurring(false); setExpRecurringPeriod('monthly'); setExpCustomDays('7')
      fetchExpenses()
    } finally {
      setSavingExpense(false)
    }
  }

  async function handleDeleteExpense(id: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu gideri silmek istediğinize emin misiniz?' })
    if (!ok) return
    const expense = expenses.find(e => e.id === id)
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
    logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'delete', resource: 'expense', details: { category: expense?.category || null, amount: expense?.amount || null } })
    fetchExpenses()
  }

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault()
    if (!incCategory || !incAmount || !incDate) return
    setSavingIncome(true)
    try {
      await fetch('/api/income', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_id: businessId,
          category: incCategory,
          description: incDescription || null,
          amount: parseFloat(incAmount),
          income_date: incDate,
          is_recurring: incIsRecurring,
          recurring_period: incIsRecurring ? incRecurringPeriod : null,
          custom_interval_days: incIsRecurring && incRecurringPeriod === 'custom' ? parseInt(incCustomDays) || null : null,
        }),
      })
      setShowIncomeForm(false)
      logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'create', resource: 'income', details: { category: incCategory, amount: parseFloat(incAmount), description: incDescription || null } })
      setIncCategory(''); setIncDescription(''); setIncAmount('')
      setIncDate(new Date().toISOString().split('T')[0])
      setIncIsRecurring(false); setIncRecurringPeriod('monthly'); setIncCustomDays('7')
      fetchIncome()
    } finally {
      setSavingIncome(false)
    }
  }

  async function handleDeleteIncome(id: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu geliri silmek istediğinize emin misiniz?' })
    if (!ok) return
    const income = incomes.find(i => i.id === id)
    await fetch(`/api/income?id=${id}`, { method: 'DELETE' })
    logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'delete', resource: 'income', details: { category: income?.category || null, amount: income?.amount || null } })
    fetchIncome()
  }

  useEffect(() => { if (!ctxLoading) fetchData() }, [fetchData, ctxLoading])

  if (permissions && !permissions.analytics) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <div className="text-center">
          <p className="text-lg font-medium text-gray-500 dark:text-gray-400">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">İşletme sahibinizle iletişime geçin.</p>
        </div>
      </div>
    )
  }

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-500" /></div>
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────

  const completed = appointments.filter(a => a.status === 'completed')
  const cancelled = appointments.filter(a => a.status === 'cancelled')
  const noShow = appointments.filter(a => a.status === 'no_show')
  const total = appointments.length

  const prevCompleted = prevAppointments.filter(a => a.status === 'completed')
  const prevTotal = prevAppointments.length

  const appointmentRevenue = completed.reduce((s, a) => s + (a.services?.price || 0), 0)
  const prevRevenue = prevCompleted.reduce((s: number, a: any) => s + (a.services?.price || 0), 0)

  // Fatura geliri: appointment_id'si olan faturalar zaten randevudan sayıldıysa tekrar sayma
  const completedAptIds = new Set(completed.map((a: any) => a.id))
  const invoiceOnlyRevenue = paidInvoices
    .filter(inv => !inv.appointment_id || !completedAptIds.has(inv.appointment_id))
    .reduce((s: number, inv: any) => s + (inv.total || 0), 0)
  const manualIncome = incomes.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)
  const totalRevenue = appointmentRevenue + invoiceOnlyRevenue + manualIncome

  const completionRate = total > 0 ? Math.round((completed.length / total) * 100) : 0
  const noShowRate = total > 0 ? Math.round((noShow.length / total) * 100) : 0
  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1)
    : '—'

  function trend(curr: number, prev: number) {
    if (prev === 0) return 0
    return Math.round(((curr - prev) / prev) * 100)
  }

  const totalTrend = trend(total, prevTotal)
  const revenueTrend = trend(totalRevenue, prevRevenue)

  // Müşteri metrikleri
  const totalCustomers = customers.length
  const newCustomers = customers.filter(c => c.segment === 'new').length
  const returningCustomers = totalCustomers - newCustomers
  const avgCLV = totalCustomers > 0
    ? (customers.reduce((s, c) => s + (c.total_revenue || 0), 0) / totalCustomers)
    : 0
  const riskCustomers = customers.filter(c => c.segment === 'risk' || c.segment === 'lost')
  const segmentData = (['new', 'regular', 'vip', 'risk', 'lost'] as const).map(seg => ({
    segment: seg, label: SEGMENT_LABELS[seg],
    count: customers.filter(c => c.segment === seg).length,
  }))

  // Kaynak dağılımı
  const sourceCounts = { web: 0, manual: 0, phone: 0 }
  for (const a of appointments) {
    if (a.source === 'web') sourceCounts.web++
    else if (a.source === 'manual') sourceCounts.manual++
    else if (a.source === 'phone') sourceCounts.phone++
  }

  // Personel performansı
  const staffStats = staffMembers.map(sm => {
    const smApts = appointments.filter(a => a.staff_id === sm.id)
    const smCompleted = smApts.filter(a => a.status === 'completed')
    const smNoShow = smApts.filter(a => a.status === 'no_show')
    const smRevenue = smCompleted.reduce((s, a) => s + (a.services?.price || 0), 0)
    return {
      ...sm,
      total: smApts.length,
      completed: smCompleted.length,
      noShowRate: smApts.length > 0 ? Math.round((smNoShow.length / smApts.length) * 100) : 0,
      revenue: smRevenue,
    }
  }).filter(s => s.total > 0).sort((a, b) => b.completed - a.completed)

  // Günlük trend (seçilen dönemdeki günler)
  const { start } = getPeriodDates(period, 0)
  const startDate = new Date(start + 'T00:00:00')
  const dayCount = period === 'week' ? 7 : period === 'month' ? 30 : 12
  const trendDays = period === 'year'
    ? Array.from({ length: 12 }, (_, i) => {
        const d = new Date(startDate); d.setMonth(d.getMonth() + i)
        const label = d.toLocaleDateString('tr-TR', { month: 'short' })
        const ym = d.toISOString().slice(0, 7)
        return { label, count: appointments.filter(a => a.appointment_date?.startsWith(ym)).length }
      })
    : Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        const label = period === 'week'
          ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d.getDay() === 0 ? 6 : d.getDay() - 1]
          : String(d.getDate())
        return { label, count: appointments.filter(a => a.appointment_date === dateStr).length }
      })
  const maxTrend = Math.max(...trendDays.map(d => d.count), 1)

  // Gelir trendi
  const trendRevenue = period === 'year'
    ? Array.from({ length: 12 }, (_, i) => {
        const d = new Date(startDate); d.setMonth(d.getMonth() + i)
        const label = d.toLocaleDateString('tr-TR', { month: 'short' })
        const ym = d.toISOString().slice(0, 7)
        const rev = completed.filter(a => a.appointment_date?.startsWith(ym)).reduce((s: number, a: any) => s + (a.services?.price || 0), 0)
        const invRev = paidInvoices.filter(inv => inv.paid_at?.startsWith(ym)).reduce((s: number, inv: any) => s + (inv.total || 0), 0)
        return { label, revenue: rev + invRev }
      })
    : Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const dateStr = d.toISOString().split('T')[0]
        const label = period === 'week'
          ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d.getDay() === 0 ? 6 : d.getDay() - 1]
          : String(d.getDate())
        const rev = completed.filter(a => a.appointment_date === dateStr).reduce((s: number, a: any) => s + (a.services?.price || 0), 0)
        const invRev = paidInvoices.filter(inv => inv.paid_at?.split('T')[0] === dateStr).reduce((s: number, inv: any) => s + (inv.total || 0), 0)
        return { label, revenue: rev + invRev }
      })
  const maxRevenue = Math.max(...trendRevenue.map(d => d.revenue), 1)

  // Saat dağılımı
  const hourDist = Array.from({ length: 14 }, (_, i) => {
    const hour = i + 8
    const count = appointments.filter(a => parseInt(a.start_time?.split(':')[0] || '0') === hour).length
    return { hour: `${String(hour).padStart(2, '0')}`, count }
  })
  const maxHour = Math.max(...hourDist.map(h => h.count), 1)

  // En popüler hizmetler
  const serviceStats = services.map(svc => {
    const count = completed.filter(a => a.service_id === svc.id).length
    return { ...svc, count, revenue: count * (svc.price || 0) }
  }).sort((a, b) => b.count - a.count)

  const periodLabel = period === 'week' ? 'Son 7 Gün' : period === 'month' ? 'Son 30 Gün' : 'Son 1 Yıl'

  return (
    <div>
      {/* Başlık */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Gelir-Gider Tablosu</h1>
          <p className="mt-1 text-sm text-gray-500">{periodLabel} · önceki dönemle karşılaştırmalı</p>
        </div>
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          {([['week', '7 Gün'], ['month', '30 Gün'], ['year', '1 Yıl']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setPeriod(key)}
              className={cn('px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
                period === key ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Kartları (dönem karşılaştırmalı) */}
      <div className="mb-6 grid grid-cols-3 gap-4">
        <KPICard icon={<DollarSign className="h-5 w-5" />} label={invoiceOnlyRevenue > 0 ? 'Toplam Gelir' : 'Gelir'}
          value={formatCurrency(totalRevenue)} trend={revenueTrend} color="green" currency />
        <KPICard icon={<Users className="h-5 w-5" />} label="Ort. Müşteri Değeri"
          value={formatCurrency(avgCLV)} color="purple" currency />
        <KPICard icon={<UserCheck className="h-5 w-5" />} label="Tamamlanan"
          value={completed.length} color="blue" />
      </div>

      {/* Sekmeler */}
      <div className="mb-4 flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto whitespace-nowrap">
        {([
          ['overview', 'Genel Bakış', <BarChart3 key="o" className="h-3.5 w-3.5" />],
          ['staff', 'Personel', <Users key="s" className="h-3.5 w-3.5" />],
          ['customers', 'Müşteriler', <UserCheck key="c" className="h-3.5 w-3.5" />],
          ['sources', 'Kaynak', <PieChart key="sr" className="h-3.5 w-3.5" />],
          ['expenses', 'Gelir-Gider', <Wallet key="e" className="h-3.5 w-3.5" />],
        ] as const).map(([key, label, icon]) => (
          <button key={key} onClick={() => setActiveTab(key as any)}
            className={cn('flex-shrink-0 flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-pulse-500 text-pulse-600 dark:text-pulse-400'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            )}>
            {icon}{label}
          </button>
        ))}
      </div>

      {/* Genel Bakış Sekmesi */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Gelir Trendi */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
              <Activity className="h-4 w-4" /> Gelir Trendi — {periodLabel}
            </h3>
            {trendRevenue.every(d => d.revenue === 0) ? (
              <div className="flex items-center justify-center h-44 text-sm text-gray-400">
                Bu dönem için gelir verisi bulunmuyor
              </div>
            ) : (
              <div className="relative">
                {/* Y ekseni */}
                <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-gray-400 w-10">
                  <span>{maxRevenue >= 1000 ? `${Math.round(maxRevenue / 1000)}k` : maxRevenue}</span>
                  <span>{maxRevenue >= 1000 ? `${Math.round(maxRevenue / 2000)}k` : Math.round(maxRevenue / 2)}</span>
                  <span>0</span>
                </div>
                <div className="ml-10 overflow-x-auto overflow-y-visible pt-8">
                  <div className={cn(
                    'flex items-end gap-1 h-44 pb-1',
                    period === 'month' ? 'min-w-[600px]' : '',
                    period === 'week' && 'justify-center gap-3'
                  )}>
                    {trendRevenue.map(({ label, revenue }, i) => {
                      const pct = (revenue / maxRevenue) * 100
                      const opacity = pct > 70 ? '' : pct > 40 ? 'opacity-80' : 'opacity-60'
                      return (
                        <div key={i} className={cn('flex-1 min-w-[18px] flex flex-col items-center h-full group relative', period === 'week' && 'max-w-[40px]')}>
                          {/* Hover tooltip */}
                          {revenue > 0 && (
                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10">
                              {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(revenue)}
                            </div>
                          )}
                          <div className="flex-1 w-full flex items-end">
                            <div className={cn('w-full bg-pulse-400 dark:bg-pulse-500 rounded-t-sm transition-all hover:bg-pulse-500 dark:hover:bg-pulse-400', opacity)}
                              style={{ height: `${pct}%`, minHeight: revenue > 0 ? '4px' : '0' }} />
                          </div>
                          <span className="text-[9px] text-gray-400 truncate w-full text-center flex-shrink-0">{label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Personel Sekmesi */}
      {activeTab === 'staff' && (
        <div className="card p-0 overflow-hidden">
          {staffStats.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">Bu dönem için personel randevu verisi yok</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-500">Personel</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Toplam</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Tamamlandı</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gelmeme %</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500">Gelir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {staffStats.map(s => (
                  <tr key={s.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{s.total}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{s.completed}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={cn('font-medium', s.noShowRate <= 5 ? 'text-green-600' : s.noShowRate <= 15 ? 'text-amber-600' : 'text-red-600')}>
                        %{s.noShowRate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 font-medium text-price">{formatCurrency(s.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Müşteriler Sekmesi */}
      {activeTab === 'customers' && (
        <div className="space-y-6">
          {/* Müşteri Özet Kartları */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-blue-600">{newCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">Yeni Müşteri</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-green-600">{returningCustomers}</p>
              <p className="text-xs text-gray-500 mt-1">Tekrar Gelen</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(avgCLV)}</p>
              <p className="text-xs text-gray-500 mt-1">Ortalama Müşteri Değeri</p>
            </div>
          </div>

          {/* Segment Dağılımı */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Müşteri Segmentleri</h3>
            <div className="space-y-3">
              {segmentData.map(({ segment, label, count }) => {
                const pct = totalCustomers > 0 ? Math.round((count / totalCustomers) * 100) : 0
                const colors: Record<string, string> = {
                  new: 'bg-blue-400', regular: 'bg-green-400', vip: 'bg-amber-400', risk: 'bg-orange-400', lost: 'bg-red-400'
                }
                return (
                  <div key={segment} className="flex items-center gap-3">
                    <span className="text-sm w-16 text-gray-600 dark:text-gray-400">{label}</span>
                    <div className="flex-1 h-5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className={cn('h-full rounded-full', colors[segment])} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100 w-16 text-right">{count} (%{pct})</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Risk Uyarısı */}
          {riskCustomers.length > 0 && (
            <div className="card p-4 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                  {riskCustomers.length} Müşteri Risk Altında
                </h3>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {riskCustomers.slice(0, 10).map(c => (
                  <span key={c.id} className="badge bg-amber-100 text-amber-700">{c.name}</span>
                ))}
                {riskCustomers.length > 10 && (
                  <span className="badge bg-amber-100 text-amber-700">+{riskCustomers.length - 10} daha</span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Giderler Sekmesi */}
      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {/* Kar-Zarar Özeti */}
          <div className="grid grid-cols-3 gap-4">
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Toplam Gelir</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(totalRevenue)}</p>
              {invoiceOnlyRevenue > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Randevu: {formatCurrency(appointmentRevenue)} · Fatura: {formatCurrency(invoiceOnlyRevenue)}
                </p>
              )}
              {manualIncome > 0 && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Manuel Gelir: {formatCurrency(manualIncome)}
                </p>
              )}
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Toplam Gider</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Net Kâr</p>
              {(() => {
                const net = totalRevenue - totalExpenses
                return <p className={cn('text-xl font-bold', net >= 0 ? 'text-pulse-600 dark:text-pulse-400' : 'text-red-600')}>{formatCurrency(net)}</p>
              })()}
            </div>
          </div>

          {/* Gider Listesi Başlığı */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{periodLabel} Giderleri</h3>
            <div className="flex items-center gap-2">
              {expenses.length > 0 && (
                <button
                  onClick={() => exportToCSV(
                    expenses.map(e => ({
                      category: e.category,
                      description: e.description || '',
                      amount: e.amount,
                      expense_date: new Date(e.expense_date).toLocaleDateString('tr-TR'),
                      is_recurring: e.is_recurring ? 'Evet' : 'Hayır',
                    })),
                    'gider-raporu',
                    [
                      { key: 'category', label: 'Kategori' },
                      { key: 'description', label: 'Açıklama' },
                      { key: 'amount', label: 'Tutar (TL)' },
                      { key: 'expense_date', label: 'Tarih' },
                      { key: 'is_recurring', label: 'Tekrarlayan' },
                    ]
                  )}
                  className="btn-secondary text-sm gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />Dışa Aktar
                </button>
              )}
              <button onClick={() => setShowIncomeForm(v => !v)} className="btn-primary text-sm bg-green-500 hover:bg-green-600">
                <Plus className="mr-1.5 h-4 w-4" />Gelir Ekle
              </button>
              <button onClick={() => setShowExpenseForm(v => !v)} className="btn-primary text-sm">
                <Plus className="mr-1.5 h-4 w-4" />Gider Ekle
              </button>
            </div>
          </div>

          {/* Gider Ekleme Formu */}
          {showExpenseForm && (
            <div className="card p-4">
              <form onSubmit={handleAddExpense} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Kategori</label>
                    <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="input" required>
                      <option value="">— Seçin —</option>
                      <option value="Kira">Kira</option>
                      <option value="Malzeme">Malzeme & Sarf</option>
                      <option value="Personel">Personel Gideri</option>
                      <option value="Fatura">Faturalar (Elektrik/Su/Doğalgaz)</option>
                      <option value="Pazarlama">Pazarlama & Reklam</option>
                      <option value="Bakım">Bakım & Onarım</option>
                      <option value="Yazılım">Yazılım & Abonelik</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tutar (TL)</label>
                    <input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} className="input" placeholder="0.00" min="0" step="0.01" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Açıklama (opsiyonel)</label>
                    <input type="text" value={expDescription} onChange={(e) => setExpDescription(e.target.value)} className="input" placeholder="Aylık kira ödemesi" />
                  </div>
                  <div>
                    <label className="label">Tarih</label>
                    <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} className="input" required />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isRecurring" checked={expIsRecurring} onChange={(e) => setExpIsRecurring(e.target.checked)} className="rounded" />
                  <label htmlFor="isRecurring" className="text-sm text-gray-700 dark:text-gray-300">Tekrarlayan gider</label>
                  {expIsRecurring && (
                    <div className="flex items-center gap-2 ml-2">
                      <select value={expRecurringPeriod} onChange={(e) => setExpRecurringPeriod(e.target.value)} className="input w-auto text-sm py-1">
                        <option value="weekly">Haftalık</option>
                        <option value="biweekly">2 Haftada Bir</option>
                        <option value="monthly">Aylık</option>
                        <option value="quarterly">3 Ayda Bir</option>
                        <option value="yearly">Yıllık</option>
                        <option value="custom">Özel</option>
                      </select>
                      {expRecurringPeriod === 'custom' && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>Her</span>
                          <input type="number" min="1" value={expCustomDays} onChange={(e) => setExpCustomDays(e.target.value)} className="input w-16 text-sm py-1 text-center" />
                          <span>günde bir</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowExpenseForm(false)} className="btn-secondary text-sm flex-1">İptal</button>
                  <button type="submit" disabled={savingExpense} className="btn-primary text-sm flex-1">
                    {savingExpense && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Gelir Ekleme Formu */}
          {showIncomeForm && (
            <div className="card p-4 border-l-4 border-l-green-500">
              <form onSubmit={handleAddIncome} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Kategori</label>
                    <select value={incCategory} onChange={(e) => setIncCategory(e.target.value)} className="input" required>
                      <option value="">— Seçin —</option>
                      <option value="Hizmet Geliri">Hizmet Geliri</option>
                      <option value="Ürün Satışı">Ürün Satışı</option>
                      <option value="Komisyon">Komisyon</option>
                      <option value="Kira Geliri">Kira Geliri</option>
                      <option value="Paket/Üyelik">Paket / Üyelik</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Tutar (TL)</label>
                    <input type="number" value={incAmount} onChange={(e) => setIncAmount(e.target.value)} className="input" placeholder="0.00" min="0" step="0.01" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Açıklama (opsiyonel)</label>
                    <input type="text" value={incDescription} onChange={(e) => setIncDescription(e.target.value)} className="input" placeholder="Hizmet ödemesi" />
                  </div>
                  <div>
                    <label className="label">Tarih</label>
                    <input type="date" value={incDate} onChange={(e) => setIncDate(e.target.value)} className="input" required />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="incIsRecurring" checked={incIsRecurring} onChange={(e) => setIncIsRecurring(e.target.checked)} className="rounded" />
                  <label htmlFor="incIsRecurring" className="text-sm text-gray-700 dark:text-gray-300">Tekrarlayan gelir</label>
                  {incIsRecurring && (
                    <div className="flex items-center gap-2 ml-2">
                      <select value={incRecurringPeriod} onChange={(e) => setIncRecurringPeriod(e.target.value)} className="input w-auto text-sm py-1">
                        <option value="weekly">Haftalık</option>
                        <option value="biweekly">2 Haftada Bir</option>
                        <option value="monthly">Aylık</option>
                        <option value="quarterly">3 Ayda Bir</option>
                        <option value="yearly">Yıllık</option>
                        <option value="custom">Özel</option>
                      </select>
                      {incRecurringPeriod === 'custom' && (
                        <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>Her</span>
                          <input type="number" min="1" value={incCustomDays} onChange={(e) => setIncCustomDays(e.target.value)} className="input w-16 text-sm py-1 text-center" />
                          <span>günde bir</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="button" onClick={() => setShowIncomeForm(false)} className="btn-secondary text-sm flex-1">İptal</button>
                  <button type="submit" disabled={savingIncome} className="flex-1 text-sm px-4 py-2 rounded-lg bg-green-500 text-white hover:bg-green-600 transition-colors font-medium disabled:opacity-50">
                    {savingIncome && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin inline" />}
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Gider Listesi */}
          {expensesLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pulse-500" /></div>
          ) : expenses.length === 0 ? (
            <div className="card flex flex-col items-center justify-center py-16 text-center">
              <Wallet className="mb-3 h-12 w-12 text-gray-200 dark:text-gray-600" />
              <p className="text-sm text-gray-500 dark:text-gray-400">Bu dönem için gider kaydı bulunmuyor</p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Tarih</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Kategori</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-500">Açıklama</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-500">Tutar</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {expenses.map(expense => (
                    <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(expense.expense_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                        {expense.category}
                        {expense.is_recurring && <span className="ml-1.5 badge bg-blue-100 text-blue-700 text-[10px]">Tekrar</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{expense.description || '—'}</td>
                      <td className="px-4 py-3 text-right font-medium text-red-600">{formatCurrency(expense.amount)}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => handleDeleteExpense(expense.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Toplam Gider</td>
                    <td className="px-4 py-3 text-right font-bold text-red-600">{formatCurrency(totalExpenses)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Gelir Listesi */}
          {incomesLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pulse-500" /></div>
          ) : incomes.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">{periodLabel} Gelirleri</h3>
              <div className="card p-0 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Tarih</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Kategori</th>
                      <th className="px-4 py-3 text-left font-medium text-gray-500">Açıklama</th>
                      <th className="px-4 py-3 text-right font-medium text-gray-500">Tutar</th>
                      <th className="px-4 py-3 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {incomes.map(income => (
                      <tr key={income.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(income.income_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                          {income.category}
                          {income.is_recurring && <span className="ml-1.5 badge bg-green-100 text-green-700 text-[10px]">Tekrar</span>}
                        </td>
                        <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{income.description || '—'}</td>
                        <td className="px-4 py-3 text-right font-medium text-green-600">{formatCurrency(income.amount)}</td>
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeleteIncome(income.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50 dark:bg-gray-700/50">
                    <tr>
                      <td colSpan={3} className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-300 text-right">Toplam Gelir (Manuel)</td>
                      <td className="px-4 py-3 text-right font-bold text-green-600">{formatCurrency(manualIncome)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Kaynak Sekmesi */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            {([
              ['web', 'Online Rezervasyon', sourceCounts.web, 'blue'],
              ['manual', 'Manuel Giriş', sourceCounts.manual, 'purple'],
              ['phone', 'Telefon', sourceCounts.phone, 'green'],
            ] as const).map(([key, label, count, color]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0
              const colorMap: Record<string, string> = { blue: 'text-blue-600', purple: 'text-purple-600', green: 'text-green-600' }
              const bgMap: Record<string, string> = { blue: 'bg-blue-100', purple: 'bg-purple-100', green: 'bg-green-100' }
              return (
                <div key={key} className="card p-4 text-center">
                  <div className={cn('inline-flex rounded-full px-3 py-1 text-2xl font-bold mb-1', colorMap[color])}>
                    {count}
                  </div>
                  <p className="text-xs text-gray-500">{label}</p>
                  <p className={cn('text-xs font-medium mt-1', colorMap[color])}>%{pct}</p>
                </div>
              )
            })}
          </div>

          {/* Görsel çubuk */}
          {total > 0 && (
            <div className="card p-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Kaynak Dağılımı</h3>
              <div className="h-6 rounded-full overflow-hidden flex">
                {sourceCounts.web > 0 && (
                  <div className="bg-blue-400 h-full" style={{ width: `${(sourceCounts.web / total) * 100}%` }} title={`Online: ${sourceCounts.web}`} />
                )}
                {sourceCounts.manual > 0 && (
                  <div className="bg-purple-400 h-full" style={{ width: `${(sourceCounts.manual / total) * 100}%` }} title={`Manuel: ${sourceCounts.manual}`} />
                )}
                {sourceCounts.phone > 0 && (
                  <div className="bg-green-400 h-full" style={{ width: `${(sourceCounts.phone / total) * 100}%` }} title={`Telefon: ${sourceCounts.phone}`} />
                )}
              </div>
              <div className="flex gap-4 mt-3 text-xs">
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-400 inline-block" />Online</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block" />Manuel</span>
                <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-400 inline-block" />Telefon</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function TrendBadge({ value }: { value: number }) {
  if (value === 0) return <span className="flex items-center gap-0.5 text-xs text-gray-400"><Minus className="h-3 w-3" />%0</span>
  if (value > 0) return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp className="h-3 w-3" />%{value}</span>
  return <span className="flex items-center gap-0.5 text-xs text-red-500"><TrendingDown className="h-3 w-3" />%{Math.abs(value)}</span>
}

function KPICard({ icon, label, value, trend, color, currency }: {
  icon: React.ReactNode; label: string; value: string | number; trend?: number; color: string; currency?: boolean
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    green: 'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  }
  return (
    <div className="card p-4 flex items-start gap-3">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', colorMap[color])}>{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className={cn('text-xl font-bold truncate', currency ? 'text-price' : 'text-gray-900 dark:text-gray-100')}>{value}</p>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
    </div>
  )
}
