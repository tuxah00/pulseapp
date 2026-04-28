'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useBusinessContext } from '@/lib/hooks/use-business-context'
import { logAudit } from '@/lib/utils/audit'
import {
  Loader2, TrendingUp, TrendingDown, Users, Calendar,
  DollarSign, AlertTriangle, Clock, Star, UserCheck, Minus,
  BarChart3, PieChart, Activity, Plus, X, Wallet, Download, Layers, Sparkles,
  Megaphone, MessageSquare,
} from 'lucide-react'
import { formatCurrency, cn, formatDateISO } from '@/lib/utils'
import { useConfirm } from '@/lib/hooks/use-confirm'
import { requirePermission } from '@/lib/hooks/use-require-permission'
import { SEGMENT_LABELS } from '@/types'
import { exportToCSV, exportAnalyticsPDF } from '@/lib/utils/export'
import type { Expense, Income } from '@/types'
import { expandRecurring } from '@/lib/utils/recurring'
import type {
  AppointmentRow,
  CustomerRow,
  ReviewRow,
  ServiceRow,
  StaffMemberRow,
  InvoiceRow,
} from '@/types/db'
import { CustomSelect } from '@/components/ui/custom-select'
import EmptyState from '@/components/ui/empty-state'
import { getCustomerLabelSingular, getCustomerLabel } from '@/lib/config/sector-modules'
import { addMonthsSafe } from '@/lib/utils/date-range'
import SeasonalChart from '@/components/dashboard/insights/seasonal-chart'
import CohortHeatmap from '@/components/dashboard/insights/cohort-heatmap'
import QuadrantTable from '@/components/dashboard/insights/quadrant-table'
import type { InsightsSummary } from '@/lib/analytics/insights'
import {
  Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip as RTooltip, XAxis, YAxis,
} from 'recharts'

// Supabase istemcisi modül seviyesinde — component re-render'larında yeniden oluşmaz
const supabase = createClient()

/**
 * Gelir-Gider paneli — 4 bölüm.
 *
 * Eski 8 tab yapısı:
 *   overview, staff, customers, sources, services, expenses, forecast, pulse_value
 * Yeni 4 bölüm:
 *   1. summary    — Özet + Trend + Tahmin + Sezonsal grafik
 *   2. breakdown  — Gelir Kırılımı (Hizmet + Kaynak)
 *   3. finance    — Gelir-Gider Yönetimi (manuel kayıt formu + tablo)
 *   4. people     — Personel & Müşteri (+ Kohort + BCG Quadrant)
 *
 * PulseApp Katkısı sekmesi kaldırıldı (test artığıydı).
 */
type AnalyticsTab = 'summary' | 'breakdown' | 'finance' | 'people'

type AnalyticsAppointment = AppointmentRow & {
  services: { name: string; price: number } | null
}

type PrevAppointment = Pick<AppointmentRow, 'status'> & {
  services: { price: number } | null
}

type StaffSummary = Pick<StaffMemberRow, 'id' | 'name'>

type AnalyticsInvoice = Pick<
  InvoiceRow,
  'id' | 'total' | 'paid_amount' | 'status' | 'appointment_id' | 'paid_at' | 'created_at'
>

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
    start = addMonthsSafe(now, -months)
    end = addMonthsSafe(now, -monthsBack)
  } else {
    const years = offset + 1
    const yearsBack = offset
    start = new Date(now); start.setFullYear(now.getFullYear() - years)
    end = new Date(now); end.setFullYear(now.getFullYear() - yearsBack)
  }

  return {
    start: formatDateISO(start),
    end: formatDateISO(end),
  }
}

export default function AnalyticsPage() {
  const { businessId, staffId, staffName, sector, plan, loading: ctxLoading, permissions } = useBusinessContext()
  const customerLabel = getCustomerLabelSingular(sector ?? undefined)
  const customerLabelPlural = sector ? getCustomerLabel(sector) : 'Müşteriler'
  const { confirm } = useConfirm()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('summary')
  const [exportingPDF, setExportingPDF] = useState(false)

  // Sezonsal + kohort + quadrant verisi (İş Zekası özetinden), people + summary tab açıldığında yüklenir
  const [insightsSummary, setInsightsSummary] = useState<InsightsSummary | null>(null)
  const [insightsLoading, setInsightsLoading] = useState(false)

  const [appointments, setAppointments] = useState<AnalyticsAppointment[]>([])
  const [prevAppointments, setPrevAppointments] = useState<PrevAppointment[]>([])
  const [customers, setCustomers] = useState<CustomerRow[]>([])
  const [reviews, setReviews] = useState<ReviewRow[]>([])
  const [services, setServices] = useState<ServiceRow[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffSummary[]>([])
  const [paidInvoices, setPaidInvoices] = useState<AnalyticsInvoice[]>([])

  // Forecast / Tahmin state
  const [forecastData, setForecastData] = useState<{
    historical: { month: string; label: string; revenue: number; demand?: 'peak'|'high'|'normal'|'low'; demand_note?: string | null; yoy_delta?: number | null }[]
    forecast: { month: string; label: string; revenue: number; lower?: number; upper?: number; demand?: 'peak'|'high'|'normal'|'low' }[]
    insights: { busiestDay: string; busiestHourLabel: string; topServices: { name: string; revenue: number; count: number }[]; nextMonthForecast: number; nextMonthLower?: number | null; nextMonthUpper?: number | null; confidencePct?: number | null; historicalMonths?: number }
    heatmap: { day: string; dayIndex: number; hour: number; count: number }[]
    maxHeatmapCount: number
  } | null>(null)
  const [forecastLoading, setForecastLoading] = useState(false)

  // Expenses state
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [expensesLoading, setExpensesLoading] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expCategory, setExpCategory] = useState('')
  const [expDescription, setExpDescription] = useState('')
  const [expAmount, setExpAmount] = useState('')
  const [expDate, setExpDate] = useState(() => formatDateISO(new Date()))
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
  const [incDate, setIncDate] = useState(() => formatDateISO(new Date()))
  const [incIsRecurring, setIncIsRecurring] = useState(false)
  const [incRecurringPeriod, setIncRecurringPeriod] = useState('monthly')
  const [incCustomDays, setIncCustomDays] = useState('7')
  const [savingIncome, setSavingIncome] = useState(false)

  // Custom interval for expenses too
  const [expCustomDays, setExpCustomDays] = useState('7')

  // Primler (komisyon kazançları)
  type CommissionEarning = { id: string; staff_members: { name: string } | null; commission_total: number; period: string; status: string }
  const [commissions, setCommissions] = useState<CommissionEarning[]>([])
  const [commissionsLoading, setCommissionsLoading] = useState(false)

  const fetchData = useCallback(async () => {
    if (!businessId) return
    setLoading(true)

    const { start, end } = getPeriodDates(period, 0)
    const { start: prevStart, end: prevEnd } = getPeriodDates(period, 1)

    try {
      const [aptRes, prevAptRes, custRes, revRes, svcRes, staffRes, invRes] = await Promise.all([
        supabase.from('appointments').select('*, services(name, price)')
          .eq('business_id', businessId).is('deleted_at', null).gte('appointment_date', start).lte('appointment_date', end).order('appointment_date'),
        supabase.from('appointments').select('status, services(price)')
          .eq('business_id', businessId).is('deleted_at', null).gte('appointment_date', prevStart).lte('appointment_date', prevEnd),
        supabase.from('customers').select('id, name, segment, total_revenue').eq('business_id', businessId).eq('is_active', true),
        // reviews — dönem başı + sonu filtresi (lte eksikti; düzeltildi)
        supabase.from('reviews').select('*').eq('business_id', businessId)
          .gte('created_at', start + 'T00:00:00').lte('created_at', end + 'T23:59:59'),
        supabase.from('services').select('*').eq('business_id', businessId).eq('is_active', true),
        supabase.from('staff_members').select('id, name').eq('business_id', businessId).eq('is_active', true),
        // Ödenen + kısmi ödenen faturalar (dönem filtresine göre)
        supabase.from('invoices').select('id, total, paid_amount, status, appointment_id, paid_at, created_at')
          .eq('business_id', businessId).in('status', ['paid', 'partial']).is('deleted_at', null)
          .gte('paid_at', start + 'T00:00:00').lte('paid_at', end + 'T23:59:59'),
      ])

      if (aptRes.data) setAppointments(aptRes.data as unknown as AnalyticsAppointment[])
      if (prevAptRes.data) setPrevAppointments(prevAptRes.data as unknown as PrevAppointment[])
      if (custRes.data) setCustomers(custRes.data as CustomerRow[])
      if (revRes.data) setReviews(revRes.data as ReviewRow[])
      if (svcRes.data) setServices(svcRes.data as ServiceRow[])
      if (staffRes.data) setStaffMembers(staffRes.data as StaffSummary[])
      if (invRes.data) setPaidInvoices(invRes.data as AnalyticsInvoice[])
    } catch {
      window.dispatchEvent(new CustomEvent('pulse-toast', {
        detail: { type: 'error', title: 'Veriler yüklenemedi', description: 'Lütfen sayfayı yenileyin.' },
      }))
    } finally {
      setLoading(false)
    }
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

  const fetchCommissions = useCallback(async () => {
    if (!businessId || !permissions?.commissions) return
    setCommissionsLoading(true)
    const { start } = getPeriodDates(period, 0)
    // commission_earnings period formatı: YYYY-MM
    const periodStr = start.slice(0, 7)
    try {
      const res = await fetch(`/api/commissions/earnings?period=${periodStr}`)
      const json = await res.json()
      setCommissions(json.earnings || [])
    } catch { /* komisyon bilgisi opsiyonel */ }
    finally { setCommissionsLoading(false) }
  }, [businessId, period, permissions])

  useEffect(() => {
    if (businessId) {
      fetchExpenses()
      fetchIncome()
      fetchCommissions()
    }
  }, [fetchExpenses, fetchIncome, fetchCommissions, businessId])

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault()
    if (!expCategory || !expAmount || !expDate) return
    setSavingExpense(true)
    try {
      const res = await fetch('/api/expenses', {
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
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Kaydedilemedi', description: 'Gider oluşturulurken bir hata oluştu.' } }))
        return
      }
      setShowExpenseForm(false)
      logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'create', resource: 'expense', details: { category: expCategory, amount: parseFloat(expAmount), description: expDescription || null } })
      setExpCategory(''); setExpDescription(''); setExpAmount('')
      setExpDate(formatDateISO(new Date()))
      setExpIsRecurring(false); setExpRecurringPeriod('monthly'); setExpCustomDays('7')
      fetchExpenses()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Oluşturuldu' } }))
    } finally {
      setSavingExpense(false)
    }
  }

  async function handleDeleteExpense(id: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu gideri silmek istediğinize emin misiniz?' })
    if (!ok) return
    const expense = expenses.find(e => e.id === id)
    const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Silinemedi', description: 'Gider silinirken bir hata oluştu.' } }))
      return
    }
    logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'delete', resource: 'expense', details: { category: expense?.category || null, amount: expense?.amount || null } })
    fetchExpenses()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
  }

  async function handleAddIncome(e: React.FormEvent) {
    e.preventDefault()
    if (!incCategory || !incAmount || !incDate) return
    setSavingIncome(true)
    try {
      const res = await fetch('/api/income', {
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
      if (!res.ok) {
        window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Kaydedilemedi', description: 'Gelir oluşturulurken bir hata oluştu.' } }))
        return
      }
      setShowIncomeForm(false)
      logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'create', resource: 'income', details: { category: incCategory, amount: parseFloat(incAmount), description: incDescription || null } })
      setIncCategory(''); setIncDescription(''); setIncAmount('')
      setIncDate(formatDateISO(new Date()))
      setIncIsRecurring(false); setIncRecurringPeriod('monthly'); setIncCustomDays('7')
      fetchIncome()
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Oluşturuldu' } }))
    } finally {
      setSavingIncome(false)
    }
  }

  async function handleDeleteIncome(id: string) {
    const ok = await confirm({ title: 'Onay', message: 'Bu geliri silmek istediğinize emin misiniz?' })
    if (!ok) return
    const income = incomes.find(i => i.id === id)
    const res = await fetch(`/api/income?id=${id}`, { method: 'DELETE' })
    if (!res.ok) {
      window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'error', title: 'Silinemedi', description: 'Gelir silinirken bir hata oluştu.' } }))
      return
    }
    logAudit({ businessId: businessId!, staffId: staffId || null, staffName: staffName || null, action: 'delete', resource: 'income', details: { category: income?.category || null, amount: income?.amount || null } })
    fetchIncome()
    window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type: 'success', title: 'Silindi' } }))
  }

  useEffect(() => { if (!ctxLoading) fetchData() }, [fetchData, ctxLoading])

  // Dönem değişince sezonsal/tahmin verileri sıfırlanır (stale gösterim önlenir)
  useEffect(() => {
    setInsightsSummary(null)
    setForecastData(null)
  }, [period])

  // Tab açıldığında forecast + insights summary lazy fetch
  useEffect(() => {
    if (ctxLoading || !businessId) return
    const forecastMonths = period === 'year' ? 12 : period === 'week' ? 1 : 3
    if (activeTab === 'summary' || activeTab === 'people') {
      if (!insightsSummary && !insightsLoading) {
        setInsightsLoading(true)
        fetch(`/api/insights/summary?businessId=${businessId}`)
          .then(r => r.json())
          .then(d => setInsightsSummary(d))
          .catch(() => {})
          .finally(() => setInsightsLoading(false))
      }
    }
    if (activeTab === 'summary' && !forecastData && !forecastLoading) {
      setForecastLoading(true)
      fetch(`/api/analytics/forecast?businessId=${businessId}&period=${period}&months=${forecastMonths}`)
        .then(r => r.json())
        .then(d => setForecastData(d))
        .catch(() => {})
        .finally(() => setForecastLoading(false))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, businessId, ctxLoading, period])

  requirePermission(permissions, 'analytics')

  if (loading || ctxLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-pulse-900" /></div>
  }

  // ── Hesaplamalar ──────────────────────────────────────────────────────────

  const completed = appointments.filter(a => a.status === 'completed')
  const cancelled = appointments.filter(a => a.status === 'cancelled')
  const noShow = appointments.filter(a => a.status === 'no_show')
  const total = appointments.length

  const prevCompleted = prevAppointments.filter(a => a.status === 'completed')
  const prevTotal = prevAppointments.length

  const appointmentRevenue = completed.reduce((s, a) => s + (a.services?.price || 0), 0)
  const prevRevenue = prevCompleted.reduce((s, a) => s + (a.services?.price || 0), 0)

  // Fatura geliri: appointment_id'si olan faturalar zaten randevudan sayıldıysa tekrar sayma
  const completedAptIds = new Set(completed.map(a => a.id))
  const invoiceOnlyRevenue = paidInvoices
    .filter(inv => !inv.appointment_id || !completedAptIds.has(inv.appointment_id))
    .reduce((s, inv) => s + (inv.paid_amount || inv.total || 0), 0)
  // Tekrarlayan gelir/gider açılımı (sentetik kayıtlar üretir)
  const { start: periodStart, end: periodEnd } = getPeriodDates(period, 0)
  const expandedExpenses = expandRecurring(expenses, periodStart, periodEnd)
  const expandedIncomes = expandRecurring(incomes, periodStart, periodEnd)
  const manualIncome = expandedIncomes.reduce((s, i) => s + i.amount, 0)
  const totalExpenses = expandedExpenses.reduce((s, e) => s + e.amount, 0)
  const totalRevenue = appointmentRevenue + invoiceOnlyRevenue + manualIncome

  // Primler (komisyon) toplamı — sadece commissions modülü açıksa
  const commissionTotal = commissions.reduce((s, c) => s + (c.commission_total || 0), 0)

  // PulseApp abonelik gideri — plana göre aylık; dönem uzunluğuna orantılanır
  const PLAN_MONTHLY_PRICES: Record<string, number> = { starter: 499, standard: 999, pro: 1999 }
  const planMonthlyPrice = PLAN_MONTHLY_PRICES[plan ?? 'starter'] ?? 499
  const pulseappCost = period === 'week' ? Math.round(planMonthlyPrice / 4.33)
    : period === 'year' ? planMonthlyPrice * 12
    : planMonthlyPrice

  // Gerçek toplam gider: manuel + primler + PulseApp
  const grandTotalExpenses = totalExpenses + commissionTotal + pulseappCost

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
  /** Yerel tarih formatı: YYYY-MM-DD (UTC kayması önlenir) */
  const toLocalDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const trendDays = period === 'year'
    ? Array.from({ length: 12 }, (_, i) => {
        const d = addMonthsSafe(startDate, i)
        const label = d.toLocaleDateString('tr-TR', { month: 'short' })
        const ym = toLocalDate(d).slice(0, 7)
        return { label, count: appointments.filter(a => a.appointment_date?.startsWith(ym)).length }
      })
    : Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const dateStr = toLocalDate(d)
        const label = period === 'week'
          ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d.getDay() === 0 ? 6 : d.getDay() - 1]
          : String(d.getDate())
        return { label, count: appointments.filter(a => a.appointment_date === dateStr).length }
      })
  const maxTrend = Math.max(...trendDays.map(d => d.count), 1)

  // Gelir trendi (çift sayımı önle: completedAptIds filtresi uygulanır)
  const nonDuplicateInvoices = paidInvoices.filter(inv => !inv.appointment_id || !completedAptIds.has(inv.appointment_id))
  const trendRevenue = period === 'year'
    ? Array.from({ length: 12 }, (_, i) => {
        const d = addMonthsSafe(startDate, i)
        const label = d.toLocaleDateString('tr-TR', { month: 'short' })
        const ym = toLocalDate(d).slice(0, 7)
        const rev = completed.filter(a => a.appointment_date?.startsWith(ym)).reduce((s, a) => s + (a.services?.price || 0), 0)
        const invRev = nonDuplicateInvoices.filter(inv => inv.paid_at?.startsWith(ym)).reduce((s, inv) => s + (inv.paid_amount || inv.total || 0), 0)
        const incRev = expandedIncomes.filter(inc => inc.date.startsWith(ym)).reduce((s, inc) => s + inc.amount, 0)
        return { label, revenue: rev + invRev + incRev }
      })
    : Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const dateStr = toLocalDate(d)
        const label = period === 'week'
          ? ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'][d.getDay() === 0 ? 6 : d.getDay() - 1]
          : String(d.getDate())
        const rev = completed.filter(a => a.appointment_date === dateStr).reduce((s, a) => s + (a.services?.price || 0), 0)
        const invRev = nonDuplicateInvoices.filter(inv => inv.paid_at?.split('T')[0] === dateStr).reduce((s, inv) => s + (inv.paid_amount || inv.total || 0), 0)
        const incRev = expandedIncomes.filter(inc => inc.date === dateStr).reduce((s, inc) => s + inc.amount, 0)
        return { label, revenue: rev + invRev + incRev }
      })
  // Gider trendi (açılmış tekrarlayan giderlerle)
  const trendExpenses = period === 'year'
    ? Array.from({ length: 12 }, (_, i) => {
        const d = addMonthsSafe(startDate, i)
        const ym = toLocalDate(d).slice(0, 7)
        return expandedExpenses.filter(e => e.date.startsWith(ym)).reduce((s, e) => s + e.amount, 0)
      })
    : Array.from({ length: dayCount }, (_, i) => {
        const d = new Date(startDate); d.setDate(d.getDate() + i)
        const dateStr = toLocalDate(d)
        return expandedExpenses.filter(e => e.date === dateStr).reduce((s, e) => s + e.amount, 0)
      })
  const maxRevenue = Math.max(...trendRevenue.map(d => d.revenue), ...trendExpenses, 1)

  // En popüler hizmetler
  const serviceStats = services.map(svc => {
    const count = completed.filter(a => a.service_id === svc.id).length
    return { ...svc, count, revenue: count * (svc.price || 0) }
  }).sort((a, b) => b.count - a.count)

  // Hizmet bazlı gelir kırılımı (tamamlanan randevulardan)
  const serviceRevenueMap = completed.reduce<Record<string, { name: string; count: number; revenue: number }>>((acc, apt) => {
    const sid = apt.service_id
    if (!sid) return acc
    const name = apt.services?.name || 'Bilinmeyen'
    const price = apt.services?.price || 0
    if (!acc[sid]) acc[sid] = { name, count: 0, revenue: 0 }
    acc[sid].count++
    acc[sid].revenue += price
    return acc
  }, {})
  const serviceRevenueList = Object.values(serviceRevenueMap).sort((a, b) => b.revenue - a.revenue)

  const periodMultiplier = period === 'week' ? 30 / 7 : period === 'month' ? 1 : 1 / 12
  const serviceRevenueWithEstimates = serviceRevenueList.map(svc => ({
    ...svc,
    monthlyEstimate: Math.round(svc.revenue * periodMultiplier),
    pctOfTotal: totalRevenue > 0 ? Math.round((svc.revenue / totalRevenue) * 100) : 0,
  }))

  const periodLabel = period === 'week' ? 'Son 7 Gün' : period === 'month' ? 'Son 30 Gün' : 'Son 1 Yıl'

  async function handleExportPDF() {
    setExportingPDF(true)
    try {
      const avgRatingNum = reviews.length > 0
        ? reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length
        : 0
      await exportAnalyticsPDF({
        periodLabel,
        totalRevenue,
        totalExpenses,
        completedCount: completed.length,
        totalCount: appointments.length,
        avgRating: avgRatingNum,
        topServices: serviceRevenueWithEstimates.slice(0, 10),
      })
    } finally {
      setExportingPDF(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Başlık */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="h-page">Gelir-Gider</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{periodLabel} · önceki dönemle karşılaştırmalı</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportPDF}
            disabled={exportingPDF || loading}
            className="btn-secondary text-sm gap-1.5"
          >
            {exportingPDF ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            PDF İndir
          </button>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            {([['week', '7 Gün'], ['month', '30 Gün'], ['year', '1 Yıl']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setPeriod(key)}
                className={cn('px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                  period === key ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                )}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Kartları (dönem karşılaştırmalı) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard icon={<DollarSign className="h-5 w-5" />} label={invoiceOnlyRevenue > 0 ? 'Toplam Gelir' : 'Gelir'}
          value={formatCurrency(totalRevenue)} trend={revenueTrend} color="green" currency />
        <KPICard icon={<TrendingDown className="h-5 w-5" />} label="Toplam Gider"
          value={formatCurrency(grandTotalExpenses)} color="amber" currency />
        <KPICard icon={<Wallet className="h-5 w-5" />} label="Net Kâr"
          value={formatCurrency(totalRevenue - grandTotalExpenses)} color={(totalRevenue - grandTotalExpenses) >= 0 ? 'blue' : 'red'} currency />
        <KPICard icon={<UserCheck className="h-5 w-5" />} label="Tamamlanan"
          value={completed.length} color="blue" />
      </div>

      {/* Sekmeler — 4 bölüm */}
      <div className="sticky top-14 z-20 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 bg-gray-50 dark:bg-gray-950 flex flex-wrap gap-1 border-b border-gray-200 dark:border-gray-700">
        {(() => {
          const tabsToShow = [
            ['summary', 'Özet & Trend', <BarChart3 key="o" className="h-3.5 w-3.5" />],
            ['breakdown', 'Gelir Kırılımı', <PieChart key="br" className="h-3.5 w-3.5" />],
            ['finance', 'Gelir-Gider Yönetimi', <Wallet key="e" className="h-3.5 w-3.5" />],
            ['people', `Personel & ${customerLabelPlural}`, <Users key="s" className="h-3.5 w-3.5" />],
          ] as const

          const handleTabClick = (key: AnalyticsTab) => {
            setActiveTab(key)
            // Lazy fetch (forecast + insights) useEffect tarafından yönetilir — burada tekrarlama yok
          }

          const renderTab = ([key, label, icon]: readonly [string, string, React.ReactElement]) => (
            <button
              key={key}
              onClick={() => handleTabClick(key as AnalyticsTab)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors',
                activeTab === key
                  ? 'border-pulse-900 text-pulse-900 dark:text-pulse-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              {icon}{label}
            </button>
          )

          return <>{tabsToShow.map(renderTab)}</>
        })()}
      </div>

      {/* 1. Bölüm — Özet & Trend (overview + forecast + sezonsal) */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {/* İkinci KPI satırı — destekleyici metrikler, daha küçük gösterim */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KPICard secondary icon={<TrendingUp className="h-4 w-4" />} label="Tahmini Aylık Gelir"
              value={formatCurrency(Math.round(totalRevenue * periodMultiplier))} color="green" currency />
            <KPICard secondary icon={<Star className="h-4 w-4" />} label={`${customerLabel} Memnuniyeti`}
              value={avgRating !== '—' ? `${avgRating} / 5` : '—'} color="amber" />
            <KPICard secondary icon={<Clock className="h-4 w-4" />} label="Tamamlanma Oranı"
              value={`%${completionRate}`} color="blue" />
            <KPICard secondary icon={<AlertTriangle className="h-4 w-4" />} label={`Risk ${customerLabelPlural}`}
              value={riskCustomers.length} color="amber" />
          </div>
          {/* Gelir-Gider Trendi */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Activity className="h-4 w-4" /> Gelir-Gider Trendi — {periodLabel}
              </h3>
              <div className="flex items-center gap-3 text-[10px] text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Gelir</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Gider</span>
              </div>
            </div>
            {trendRevenue.every(d => d.revenue === 0) && trendExpenses.every(e => e === 0) && totalRevenue === 0 && totalExpenses === 0 ? (
              <div className="flex items-center justify-center h-44 text-sm text-gray-400">
                Bu dönem için veri bulunmuyor
              </div>
            ) : (
              <div className="relative">
                {/* Y ekseni */}
                <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-gray-400 w-10">
                  <span>{maxRevenue >= 1000 ? `${Math.round(maxRevenue / 1000)}k` : maxRevenue}</span>
                  <span>{maxRevenue >= 1000 ? `${Math.round(maxRevenue / 2000)}k` : Math.round(maxRevenue / 2)}</span>
                  <span>0</span>
                </div>
                <div className="ml-10 overflow-y-visible pt-8">
                  <div className={cn(
                    'flex items-end gap-1 h-44 pb-1',
                    period === 'week' && 'justify-center gap-3'
                  )}>
                    {trendRevenue.map(({ label, revenue }, i) => {
                      const expense = trendExpenses[i] || 0
                      const revPct = (revenue / maxRevenue) * 100
                      const expPct = (expense / maxRevenue) * 100
                      return (
                        <div key={i} className={cn('flex-1 min-w-[18px] flex flex-col items-center h-full group relative', period === 'week' && 'max-w-[40px]')}>
                          <div className="flex-1 w-full flex items-end gap-px relative">
                            {(revenue > 0 || expense > 0) && (
                              <div
                                className="absolute left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-900 text-white text-[10px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-10 pointer-events-none"
                                style={{ bottom: `calc(${Math.max(revPct, expPct)}% + 6px)` }}
                              >
                                {revenue > 0 && <span className="text-emerald-300">{formatCurrency(revenue)}</span>}
                                {revenue > 0 && expense > 0 && ' / '}
                                {expense > 0 && <span className="text-red-300">{formatCurrency(expense)}</span>}
                              </div>
                            )}
                            <div className="flex-1 bg-emerald-400 dark:bg-emerald-600 rounded-t-sm transition-all"
                              style={{ height: `${revPct}%`, minHeight: revenue > 0 ? '4px' : '0' }} />
                            <div className="flex-1 bg-red-300 dark:bg-red-500 rounded-t-sm transition-all"
                              style={{ height: `${expPct}%`, minHeight: expense > 0 ? '4px' : '0' }} />
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

          {/* Sezonsal Gelir Grafiği (İş Zekası özetinden) */}
          {insightsSummary?.seasonal?.monthly && insightsSummary.seasonal.monthly.length > 0 && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Sezonsal Gelir Paterni</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Son 12 ayın aylık gelir trendi + sektörel sezon işaretleri</p>
                </div>
              </div>
              <SeasonalChart data={insightsSummary.seasonal.monthly} />
            </div>
          )}

          {insightsLoading && !insightsSummary && (
            <div className="card p-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sezonsal grafik yükleniyor…
            </div>
          )}
        </div>
      )}

      {/* 4. Bölüm — Personel & Müşteri */}
      {activeTab === 'people' && (
        <div className="space-y-6">
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Users className="h-4 w-4" /> Personel Karnesi
            </h3>
          {staffStats.length === 0 ? (
            <EmptyState
              icon={<Users className="h-7 w-7" />}
              title="Personel verisi yok"
              description="Bu dönem için personel randevu verisi bulunmuyor."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {staffStats.map(s => {
                const cRate = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0
                const monthlyEst = Math.round(s.revenue * periodMultiplier)
                const initials = s.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={s.id} className="card p-5">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-sm font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{s.name}</p>
                        <p className="text-xs text-gray-400">Personel</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5 mb-3">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Toplam Randevu</p>
                        <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{s.total}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Tamamlama</p>
                        <p className={cn('text-xl font-bold', cRate >= 80 ? 'text-green-600' : cRate >= 60 ? 'text-amber-600' : 'text-red-600')}>%{cRate}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Dönem Geliri</p>
                        <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{formatCurrency(s.revenue)}</p>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2.5">
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-0.5">Tahmini Aylık</p>
                        <p className="text-sm font-bold text-green-600">~{formatCurrency(monthlyEst)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-100 dark:border-gray-700">
                      <span className="text-gray-500 dark:text-gray-400">Gelmeme Oranı</span>
                      <span className={cn('font-semibold', s.noShowRate <= 5 ? 'text-green-600' : s.noShowRate <= 15 ? 'text-amber-600' : 'text-red-600')}>%{s.noShowRate}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          </section>

          {/* Müşteri Özet Kartları */}
          <section>
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <UserCheck className="h-4 w-4" /> {customerLabelPlural} Analizi
            </h3>
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
              <p className="text-2xl font-bold text-pulse-900 dark:text-pulse-300">{formatCurrency(avgCLV)}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ortalama {customerLabel} Değeri</p>
            </div>
          </div>

          {/* Segment Dağılımı */}
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">{customerLabel} Segmentleri</h3>
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
            <div className="card p-4 border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                    Riskli {customerLabel}
                  </h3>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                    {riskCustomers.length} {customerLabel.toLowerCase()} — son ziyaretten uzun süre geçmiş
                  </p>
                </div>
                <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/dashboard/customers?segment=risk"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/40 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <Users className="h-3.5 w-3.5" /> Görüntüle
                </Link>
                <Link
                  href="/dashboard/campaigns?segment=risk"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/40 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <Megaphone className="h-3.5 w-3.5" /> Kampanya Oluştur
                </Link>
                <Link
                  href="/dashboard/campaigns?segment=risk&channel=whatsapp"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-gray-800 border border-amber-200 dark:border-amber-900/40 text-xs font-medium text-amber-800 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Mesaj Akışı Oluştur
                </Link>
              </div>
            </div>
          )}
            </div>
          </section>

          {/* Kohort Retansiyon + BCG Quadrant (İş Zekası özetinden) */}
          {insightsSummary && (
            <>
              {insightsSummary.cohort && insightsSummary.cohort.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Kohort Retansiyon
                  </h3>
                  <div className="card p-4">
                    <CohortHeatmap cohort={insightsSummary.cohort} />
                  </div>
                </section>
              )}

              {insightsSummary.margin && insightsSummary.margin.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <Layers className="h-4 w-4" /> Hizmet Performans Matrisi
                  </h3>
                  <QuadrantTable rows={insightsSummary.margin} />
                </section>
              )}
            </>
          )}

          {insightsLoading && !insightsSummary && (
            <div className="card p-6 flex items-center justify-center gap-2 text-sm text-gray-500 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Kohort ve hizmet matrisi yükleniyor…
            </div>
          )}
        </div>
      )}

      {/* 3. Bölüm — Gelir-Gider Yönetimi (expenses + income form + table) */}
      {activeTab === 'finance' && (
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
              <p className="text-xl font-bold text-red-600">{formatCurrency(grandTotalExpenses)}</p>
              {(commissionTotal > 0 || pulseappCost > 0) && (
                <p className="text-[10px] text-gray-400 mt-1">
                  {commissionTotal > 0 && `Primler: ${formatCurrency(commissionTotal)}`}
                  {commissionTotal > 0 && pulseappCost > 0 && ' · '}
                  {pulseappCost > 0 && `PulseApp: ${formatCurrency(pulseappCost)}`}
                </p>
              )}
            </div>
            <div className="card p-4 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Net Kâr</p>
              {(() => {
                const net = totalRevenue - grandTotalExpenses
                return <p className={cn('text-xl font-bold', net >= 0 ? 'text-pulse-900 dark:text-pulse-400' : 'text-red-600')}>{formatCurrency(net)}</p>
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
                    <CustomSelect
                      value={expCategory}
                      onChange={v => setExpCategory(v)}
                      placeholder="— Seçin —"
                      options={[
                        { value: 'Kira', label: 'Kira' },
                        { value: 'Malzeme', label: 'Malzeme & Sarf' },
                        { value: 'Personel', label: 'Personel Gideri' },
                        { value: 'Fatura', label: 'Faturalar (Elektrik/Su/Doğalgaz)' },
                        { value: 'Pazarlama', label: 'Pazarlama & Reklam' },
                        { value: 'Bakım', label: 'Bakım & Onarım' },
                        { value: 'Yazılım', label: 'Yazılım & Abonelik' },
                        { value: 'Diğer', label: 'Diğer' },
                      ]}
                    />
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
                      <div className="w-40">
                        <CustomSelect
                          value={expRecurringPeriod}
                          onChange={v => setExpRecurringPeriod(v)}
                          options={[
                            { value: 'weekly', label: 'Haftalık' },
                            { value: 'biweekly', label: '2 Haftada Bir' },
                            { value: 'monthly', label: 'Aylık' },
                            { value: 'quarterly', label: '3 Ayda Bir' },
                            { value: 'yearly', label: 'Yıllık' },
                            { value: 'custom', label: 'Özel' },
                          ]}
                        />
                      </div>
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
            <div className="card p-4 bg-green-50/30 dark:bg-green-950/10">
              <form onSubmit={handleAddIncome} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Kategori</label>
                    <CustomSelect
                      value={incCategory}
                      onChange={v => setIncCategory(v)}
                      placeholder="— Seçin —"
                      options={[
                        { value: 'Hizmet Geliri', label: 'Hizmet Geliri' },
                        { value: 'Ürün Satışı', label: 'Ürün Satışı' },
                        { value: 'Komisyon', label: 'Komisyon' },
                        { value: 'Kira Geliri', label: 'Kira Geliri' },
                        { value: 'Paket/Üyelik', label: 'Paket / Üyelik' },
                        { value: 'Diğer', label: 'Diğer' },
                      ]}
                    />
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
                      <div className="w-40">
                        <CustomSelect
                          value={incRecurringPeriod}
                          onChange={v => setIncRecurringPeriod(v)}
                          options={[
                            { value: 'weekly', label: 'Haftalık' },
                            { value: 'biweekly', label: '2 Haftada Bir' },
                            { value: 'monthly', label: 'Aylık' },
                            { value: 'quarterly', label: '3 Ayda Bir' },
                            { value: 'yearly', label: 'Yıllık' },
                            { value: 'custom', label: 'Özel' },
                          ]}
                        />
                      </div>
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
                  <button type="submit" disabled={savingIncome} className="btn-success flex-1 text-sm">
                    {savingIncome && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin inline" />}
                    Kaydet
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Gider Listesi */}
          {expensesLoading || commissionsLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
          ) : (expenses.length === 0 && commissionTotal === 0) ? (
            <EmptyState
              icon={<Wallet className="h-7 w-7" />}
              title="Gider kaydı yok"
              description="Bu dönem için gider kaydı bulunmuyor."
            />
          ) : (
            <div className="table-wrapper">
              <table className="table-base">
                <thead className="table-head-row">
                  <tr>
                    <th className="table-head-cell">Tarih</th>
                    <th className="table-head-cell">Kategori</th>
                    <th className="table-head-cell">Açıklama</th>
                    <th className="table-head-cell text-right">Tutar</th>
                    <th className="table-head-cell w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map(expense => (
                    <tr key={expense.id} className="table-row">
                      <td className="table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(expense.expense_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                      </td>
                      <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                        {expense.category}
                        {expense.is_recurring && <span className="ml-1.5 badge-info text-[10px]">Tekrar</span>}
                      </td>
                      <td className="table-cell text-gray-500 dark:text-gray-400">{expense.description || '—'}</td>
                      <td className="table-cell text-right font-medium text-red-600">{formatCurrency(expense.amount)}</td>
                      <td className="table-cell">
                        <button onClick={() => handleDeleteExpense(expense.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                          <X className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {/* Prim satırları (komisyon kazançları) */}
                  {commissions.map(c => (
                    <tr key={`commission-${c.id}`} className="table-row bg-amber-50/40 dark:bg-amber-900/10">
                      <td className="table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">—</td>
                      <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                        Personel Primi
                        <span className={cn('ml-1.5 text-[10px] rounded-full px-1.5 py-0.5 font-medium', c.status === 'paid' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400')}>
                          {c.status === 'paid' ? 'Ödendi' : 'Bekliyor'}
                        </span>
                      </td>
                      <td className="table-cell text-gray-500 dark:text-gray-400">{c.staff_members?.name ?? '—'}</td>
                      <td className="table-cell text-right font-medium text-red-600">{formatCurrency(c.commission_total)}</td>
                      <td className="table-cell"></td>
                    </tr>
                  ))}
                  {/* PulseApp abonelik gideri */}
                  <tr className="table-row bg-blue-50/40 dark:bg-blue-900/10">
                    <td className="table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">—</td>
                    <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                      Yazılım Aboneliği
                      <span className="ml-1.5 badge-info text-[10px]">Sistem</span>
                    </td>
                    <td className="table-cell text-gray-500 dark:text-gray-400">
                      PulseApp {plan ? plan.charAt(0).toUpperCase() + plan.slice(1) : 'Starter'} Plan
                    </td>
                    <td className="table-cell text-right font-medium text-red-600">{formatCurrency(pulseappCost)}</td>
                    <td className="table-cell"></td>
                  </tr>
                </tbody>
                <tfoot className="table-head-row">
                  <tr>
                    <td colSpan={3} className="table-cell font-semibold text-gray-700 dark:text-gray-300 text-right">Toplam Gider</td>
                    <td className="table-cell text-right font-bold text-red-600">{formatCurrency(grandTotalExpenses)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Gelir Listesi */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{periodLabel} Gelirleri</h3>
            <button onClick={() => setShowIncomeForm(v => !v)} className="btn-success text-sm">
              <Plus className="mr-1.5 h-4 w-4" />Gelir Ekle
            </button>
          </div>
          {incomesLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-pulse-900" /></div>
          ) : (completed.length > 0 || incomes.length > 0) && (
            <div>
              <div className="table-wrapper">
                <table className="table-base">
                  <thead className="table-head-row">
                    <tr>
                      <th className="table-head-cell">Tarih</th>
                      <th className="table-head-cell">Kategori</th>
                      <th className="table-head-cell">Açıklama</th>
                      <th className="table-head-cell text-right">Tutar</th>
                      <th className="table-head-cell w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Randevu geliri özet satırı */}
                    {completed.length > 0 && (
                      <tr className="table-row">
                        <td className="table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">—</td>
                        <td className="table-cell font-medium text-gray-900 dark:text-gray-100">Randevular</td>
                        <td className="table-cell text-gray-500 dark:text-gray-400">{completed.length} tamamlanan randevu</td>
                        <td className="table-cell text-right font-medium text-green-600">{formatCurrency(appointmentRevenue)}</td>
                        <td className="table-cell"></td>
                      </tr>
                    )}
                    {/* Manuel gelir satırları */}
                    {incomes.map(income => (
                      <tr key={income.id} className="table-row">
                        <td className="table-cell text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {new Date(income.income_date).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' })}
                        </td>
                        <td className="table-cell font-medium text-gray-900 dark:text-gray-100">
                          {income.category}
                          {income.is_recurring && <span className="ml-1.5 badge-info text-[10px]">Tekrar</span>}
                        </td>
                        <td className="table-cell text-gray-500 dark:text-gray-400">{income.description || '—'}</td>
                        <td className="table-cell text-right font-medium text-green-600">{formatCurrency(income.amount)}</td>
                        <td className="table-cell">
                          <button onClick={() => handleDeleteIncome(income.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                            <X className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="table-head-row">
                    <tr>
                      <td colSpan={3} className="table-cell font-semibold text-gray-700 dark:text-gray-300 text-right">Toplam Gelir</td>
                      <td className="table-cell text-right font-bold text-green-600">{formatCurrency(totalRevenue)}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Bölüm (hizmet) — Gelir Kırılımı */}
      {activeTab === 'breakdown' && (
        <div className="space-y-5">
          {serviceRevenueWithEstimates.length === 0 ? (
            <EmptyState
              icon={<Layers className="h-7 w-7" />}
              title="Hizmet verisi yok"
              description="Bu dönem için hizmet verisi bulunmuyor."
            />
          ) : (
            <>
              {/* Özet kartları */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">En Çok Kazandıran</p>
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400 truncate">{serviceRevenueWithEstimates[0]?.name}</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatCurrency(serviceRevenueWithEstimates[0]?.revenue || 0)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Ort. Hizmet Başına</p>
                  <p className="text-lg font-bold text-pulse-900 dark:text-pulse-300">{formatCurrency(serviceRevenueWithEstimates.length > 0 ? Math.round(serviceRevenueWithEstimates.reduce((s, sv) => s + sv.revenue, 0) / serviceRevenueWithEstimates.length) : 0)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Aktif Hizmet Sayısı</p>
                  <p className="text-lg font-bold text-blue-600">{serviceRevenueWithEstimates.length}</p>
                </div>
                <div className="card p-4">
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">Tahmini Aylık Gelir</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(Math.round(serviceRevenueWithEstimates.reduce((s, sv) => s + sv.monthlyEstimate, 0)))}</p>
                </div>
              </div>

              {/* Hizmet listesi */}
              <div className="space-y-3">
                {serviceRevenueWithEstimates.map((svc, idx) => {
                  const isTop = idx === 0
                  const avgPerApt = svc.count > 0 ? Math.round(svc.revenue / svc.count) : 0
                  return (
                    <div key={idx} className={cn(
                      'card p-4',
                      isTop && 'ring-1 ring-amber-200/60 dark:ring-amber-700/30 bg-amber-50/40 dark:bg-amber-900/10'
                    )}>
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          {isTop && <Star className="h-4 w-4 text-amber-500 flex-shrink-0" />}
                          <span className={cn('text-sm font-semibold truncate', isTop ? 'text-amber-800 dark:text-amber-300' : 'text-gray-900 dark:text-gray-100')}>{svc.name}</span>
                        </div>
                        <span className={cn('text-base font-bold flex-shrink-0', isTop ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-gray-100')}>{formatCurrency(svc.revenue)}</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden mb-2.5">
                        <div className={cn('h-full rounded-full transition-all', isTop ? 'bg-amber-500' : 'bg-pulse-900 dark:bg-pulse-400')} style={{ width: `${svc.pctOfTotal}%` }} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                        <span>{svc.count} randevu</span>
                        <span>Ort. {formatCurrency(avgPerApt)}</span>
                        <span className="text-green-600 dark:text-green-400 font-medium">~{formatCurrency(svc.monthlyEstimate)}/ay</span>
                        <span>Toplam payı %{svc.pctOfTotal}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Toplam satırı */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl text-sm">
                <span className="font-semibold text-gray-700 dark:text-gray-300">Toplam ({serviceRevenueWithEstimates.reduce((s, r) => s + r.count, 0)} randevu)</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{formatCurrency(serviceRevenueWithEstimates.reduce((s, r) => s + r.revenue, 0))}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* 2. Bölüm (kaynak) — Gelir Kırılımı devamı */}
      {activeTab === 'breakdown' && (
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

      {/* 1. Bölüm (tahmin) — Özet & Trend devamı */}
      {activeTab === 'summary' && (
        <div className="space-y-6">
          {forecastLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          )}

          {!forecastLoading && !forecastData && (
            <div className="card p-6 text-center py-16">
              <Sparkles className="h-10 w-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-500">Tahmin verisi yüklenemedi.</p>
            </div>
          )}

          {!forecastLoading && forecastData && (
            <>
              {/* Özet Kartlar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tahmini Gelir (Sonraki Ay)</p>
                  <p className="text-2xl font-bold text-pulse-900 dark:text-pulse-300">{formatCurrency(forecastData.insights.nextMonthForecast)}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">En Yoğun Gün</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{forecastData.insights.busiestDay}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">En Yoğun Saat</p>
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100">{forecastData.insights.busiestHourLabel}</p>
                </div>
                <div className="card p-4 text-center">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Geçmiş Veri</p>
                  <p className="text-xl font-bold text-gray-900 dark:text-gray-100">{forecastData.insights.historicalMonths ?? 6} Ay</p>
                  {forecastData.insights.confidencePct != null && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-0.5">±%{forecastData.insights.confidencePct} belirsizlik</p>
                  )}
                </div>
              </div>

              {/* Gelir Trendi & Tahmin — İş Zekası verisine dayalı, belirsizlik bantlı */}
              <div className="card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Gelir Trendi & Tahmin</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">İş Zekası sezonsal verisi + trend bileşimi</p>
                  </div>
                  {forecastData.insights.nextMonthLower != null && forecastData.insights.nextMonthUpper != null && (
                    <div className="text-right">
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">Sonraki ay aralığı</p>
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300">
                        {formatCurrency(forecastData.insights.nextMonthLower)} – {formatCurrency(forecastData.insights.nextMonthUpper)}
                      </p>
                    </div>
                  )}
                </div>
                {(() => {
                  const chartData = [
                    ...forecastData.historical.map(h => ({
                      label: h.label,
                      actual: h.revenue,
                      forecast: null as number | null,
                      lower: null as number | null,
                      upperDelta: null as number | null,
                      demand: h.demand ?? 'normal',
                      demand_note: h.demand_note ?? null,
                      yoy_delta: h.yoy_delta ?? null,
                    })),
                    ...forecastData.forecast.map(f => ({
                      label: f.label,
                      actual: null as number | null,
                      forecast: f.revenue,
                      lower: f.lower ?? f.revenue,
                      upperDelta: Math.max(0, (f.upper ?? f.revenue) - (f.lower ?? f.revenue)),
                      demand: f.demand ?? 'normal',
                      demand_note: null,
                      yoy_delta: null,
                    })),
                  ]
                  // Son gerçek ile ilk tahmin arasında süreklilik — son historical'a forecast değerini ekle
                  const lastHistIdx = forecastData.historical.length - 1
                  if (lastHistIdx >= 0 && chartData[lastHistIdx]) {
                    chartData[lastHistIdx].forecast = chartData[lastHistIdx].actual
                  }
                  return (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" className="dark:stroke-gray-700" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis
                            tick={{ fontSize: 11 }}
                            tickFormatter={(v) => {
                              if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
                              if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`
                              return String(v)
                            }}
                          />
                          <RTooltip
                            content={({ active, payload, label }) => {
                              if (!active || !payload || !payload.length) return null
                              const row: any = payload[0].payload
                              const isForecast = row.actual == null
                              const demandLabel: Record<string, string> = { peak: 'Zirve', high: 'Yoğun', normal: 'Normal', low: 'Düşük' }
                              return (
                                <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-lg px-3 py-2 text-xs">
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{label}</div>
                                  {isForecast ? (
                                    <>
                                      <div className="mt-0.5 text-gray-700 dark:text-gray-300">
                                        Tahmin: <span className="font-semibold text-pulse-900 dark:text-pulse-400">{formatCurrency(row.forecast)}</span>
                                      </div>
                                      {row.lower != null && (
                                        <div className="text-gray-500 dark:text-gray-400">
                                          Aralık: {formatCurrency(row.lower)} – {formatCurrency(row.lower + row.upperDelta)}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <div className="mt-0.5 text-gray-700 dark:text-gray-300">
                                      Gerçek: <span className="font-semibold text-pulse-900 dark:text-pulse-400">{formatCurrency(row.actual)}</span>
                                      {row.yoy_delta != null && (
                                        <span className={`ml-1 ${row.yoy_delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : row.yoy_delta < 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'}`}>
                                          (YoY {row.yoy_delta > 0 ? '+' : ''}{row.yoy_delta.toFixed(1)}%)
                                        </span>
                                      )}
                                    </div>
                                  )}
                                  {row.demand && row.demand !== 'normal' && (
                                    <div className="mt-0.5 text-gray-500 dark:text-gray-400">Sezon: {demandLabel[row.demand]}</div>
                                  )}
                                  {row.demand_note && (
                                    <div className="mt-0.5 text-gray-500 dark:text-gray-400">{row.demand_note}</div>
                                  )}
                                </div>
                              )
                            }}
                          />
                          {/* Belirsizlik bandı (stacked: lower + delta) */}
                          <Area type="monotone" dataKey="lower" stackId="band" stroke="none" fill="transparent" legendType="none" />
                          <Area type="monotone" dataKey="upperDelta" stackId="band" stroke="none" fill="#193d8f" fillOpacity={0.12} name="Belirsizlik aralığı" />
                          {/* Gerçek gelir çizgisi */}
                          <Line type="monotone" dataKey="actual" stroke="#193d8f" strokeWidth={2.5} dot={{ r: 3, fill: '#193d8f' }} name="Gerçek Gelir" connectNulls={false} />
                          {/* Tahmin çizgisi (kesikli) */}
                          <Line type="monotone" dataKey="forecast" stroke="#193d8f" strokeWidth={2.5} strokeDasharray="5 4" dot={{ r: 3, fill: '#fff', stroke: '#193d8f', strokeWidth: 2 }} name="Tahmin" connectNulls={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )
                })()}
                <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-pulse-900 dark:bg-pulse-400 inline-block" />Gerçek Gelir</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 border-t-2 border-dashed border-pulse-900 dark:border-pulse-400 inline-block" />Tahmin</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm inline-block" style={{ background: 'rgba(25,61,143,0.2)' }} />Belirsizlik bandı</span>
                </div>
                <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
                  <Sparkles className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    <span className="font-medium text-amber-900 dark:text-amber-200">Tahminler yaklaşıktır.</span>{' '}
                    Geçmiş gelir trendi ve sektörel sezonsallığa dayanır; kampanya, tatil, beklenmedik olaylar sonucu sapabilir. Gölgeli alan olası aralığı gösterir.
                  </span>
                </div>
              </div>

              {/* Top 3 Hizmet */}
              {forecastData.insights.topServices.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">En Çok Gelir Getiren Hizmetler</h3>
                  <div className="space-y-3">
                    {forecastData.insights.topServices.map((svc, i) => {
                      const topServiceMax = forecastData.insights.topServices[0]?.revenue || 1
                      const pct = Math.round((svc.revenue / topServiceMax) * 100)
                      const medals = ['🥇', '🥈', '🥉']
                      return (
                        <div key={i} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{medals[i]} {svc.name}</span>
                            <span className="text-gray-600 dark:text-gray-400">{formatCurrency(svc.revenue)} <span className="text-gray-400">({svc.count} randevu)</span></span>
                          </div>
                          <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                            <div className="h-full bg-pulse-900 dark:bg-pulse-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Yoğunluk Haritası */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-4">Haftalık Yoğunluk Haritası</h3>
                <div className="overflow-x-auto">
                  <div className="min-w-[480px]">
                    {/* Saat başlıkları */}
                    <div className="flex mb-1">
                      <div className="w-20 flex-shrink-0" />
                      {[8, 10, 12, 14, 16, 18, 20].map(h => (
                        <div key={h} className="flex-1 text-center text-xs text-gray-400">{h}:00</div>
                      ))}
                    </div>
                    {/* Günler */}
                    {['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'].map((dayLabel, dayIdx) => {
                      const realDayIndex = dayIdx === 6 ? 0 : dayIdx + 1 // Pazar=0
                      return (
                        <div key={dayLabel} className="flex items-center mb-1 gap-0.5">
                          <div className="w-20 flex-shrink-0 text-xs text-gray-500 dark:text-gray-400 truncate">{dayLabel}</div>
                          {Array.from({ length: 15 }, (_, hi) => hi + 7).map(hour => {
                            const cell = forecastData.heatmap.find(c => c.dayIndex === realDayIndex && c.hour === hour)
                            const count = cell?.count || 0
                            const intensity = forecastData.maxHeatmapCount > 0 ? count / forecastData.maxHeatmapCount : 0
                            return (
                              <div
                                key={hour}
                                title={`${dayLabel} ${hour}:00 — ${count} randevu`}
                                className="flex-1 h-6 rounded-sm transition-colors"
                                style={{
                                  backgroundColor: count === 0
                                    ? 'var(--heatmap-empty)'
                                    : `rgba(var(--heatmap-fill), ${0.15 + intensity * 0.85})`,
                                }}
                              />
                            )
                          })}
                        </div>
                      )
                    })}
                    {/* Renk skalası */}
                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <span>Az</span>
                      {[0.15, 0.3, 0.45, 0.6, 0.75, 1.0].map((op, i) => (
                        <div key={i} className="w-5 h-3 rounded-sm" style={{ backgroundColor: `rgba(var(--heatmap-fill), ${op})` }} />
                      ))}
                      <span>Çok</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
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

function KPICard({ icon, label, value, trend, color, currency, secondary }: {
  icon: React.ReactNode; label: string; value: string | number; trend?: number; color: string; currency?: boolean; secondary?: boolean
}) {
  const colorMap: Record<string, { icon: string; bg: string; text: string }> = {
    blue:   { icon: 'bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400',   bg: 'bg-blue-50 dark:bg-blue-950/40',   text: 'text-blue-600 dark:text-blue-400' },
    green:  { icon: 'bg-green-500/10 dark:bg-green-500/20 text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-950/40', text: 'text-green-600 dark:text-green-400' },
    purple: { icon: 'bg-purple-500/10 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/40', text: 'text-purple-600 dark:text-purple-400' },
    amber:  { icon: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',  bg: 'bg-amber-50 dark:bg-amber-950/40',  text: 'text-amber-600 dark:text-amber-400' },
    red:    { icon: 'bg-red-500/10 dark:bg-red-500/20 text-red-600 dark:text-red-400',        bg: 'bg-red-50 dark:bg-red-950/40',        text: 'text-red-600 dark:text-red-400' },
  }
  const cfg = colorMap[color] || colorMap.blue
  if (secondary) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
        <div className={cn('shrink-0', cfg.text)}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-gray-400 dark:text-gray-500 truncate">{label}</p>
          <p className="text-base font-semibold text-gray-800 dark:text-gray-100 leading-tight">{value}</p>
        </div>
        {trend !== undefined && <div className="ml-auto shrink-0"><TrendBadge value={trend} /></div>}
      </div>
    )
  }
  return (
    <div className={cn('relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 p-4 transition-all hover:shadow-sm', cfg.bg)}>
      <div className="flex items-start justify-between mb-3">
        <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', cfg.icon)}>{icon}</div>
        {trend !== undefined && <TrendBadge value={trend} />}
      </div>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-gray-50">{value}</p>
    </div>
  )
}
