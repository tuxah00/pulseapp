import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Calendar,
  Star,
  AlertTriangle,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Scissors,
  CreditCard,
  UserPlus,
  ArrowRight,
} from 'lucide-react'
import { addDays, format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import { SEGMENT_LABELS } from '@/types'
import { getCustomerLabel, getCustomerLabelSingular } from '@/lib/config/sector-modules'
import type { SectorType } from '@/types'
import type {
  AppointmentRow,
  BusinessStatsView,
  CustomerRow,
  NotificationRow,
} from '@/types/db'
import TodayAppointments from './_components/today-appointments'
import WeeklyInsights from './_components/weekly-insights'
import PerformanceStats from './_components/performance-stats'
import AiInsightsWidget from './_components/ai-insights-widget'
import AiBriefWidget from './_components/ai-brief-widget'
import { Sparkline } from '@/components/ui/sparkline'
import { DetailToggle } from '@/components/dashboard/_components/detail-toggle'

type TodayAppointmentRow = AppointmentRow & {
  customers: { name: string; phone: string | null } | null
  services: { name: string; duration_minutes: number } | null
  staff_members: { name: string } | null
}

type RiskCustomerRow = Pick<CustomerRow, 'id' | 'name' | 'segment' | 'last_visit_at'>
type WeekAppointmentRow = Pick<AppointmentRow, 'appointment_date' | 'status'>
type DateOnlyAppointment = Pick<AppointmentRow, 'appointment_date'>
type ReviewSummary = { rating: number | null; created_at: string | null }

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, name, businesses(sector)')
    .eq('user_id', user.id)
    .single()

  if (!staff) redirect('/auth/register')
  const businessId = staff.business_id
  const sector = ((staff as unknown as { businesses: { sector?: string } }).businesses?.sector || 'other') as SectorType
  const customerLabelPlural = getCustomerLabel(sector)
  const customerLabel = getCustomerLabelSingular(sector)

  const today = new Date().toISOString().split('T')[0]
  const d7 = new Date(); d7.setDate(d7.getDate() - 6)
  const sevenAgo = d7.toISOString().split('T')[0]
  const sevenAgoISO = d7.toISOString()

  // Haftalık randevu için tarih aralığı (Pzt-Paz)
  const nowDate = new Date()
  const dayOfWeek = nowDate.getDay() // 0=Paz
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
  const weekStart = new Date(nowDate); weekStart.setDate(nowDate.getDate() + mondayOffset)
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6)
  const weekStartStr = weekStart.toISOString().split('T')[0]
  const weekEndStr = weekEnd.toISOString().split('T')[0]

  let todayAppointments: TodayAppointmentRow[] = []
  let stats: BusinessStatsView | null = null
  let notifications: NotificationRow[] = []
  let riskCustomers: RiskCustomerRow[] = []
  let aptTrend: number[] = []
  let ratingTrend: number[] = []
  let weeklyAppointments: WeekAppointmentRow[] = []

  try {
    const results = await Promise.all([
      supabase
        .from('appointments')
        .select('*, customers(name, phone), services(name, duration_minutes), staff_members(name)')
        .eq('business_id', businessId)
        .eq('appointment_date', today)
        .is('deleted_at', null)
        .order('start_time'),

      supabase
        .from('business_stats')
        .select('*')
        .eq('business_id', businessId)
        .single(),

      supabase
        .from('notifications')
        .select('id, type, title, body, is_read, created_at, related_id, related_type')
        .eq('business_id', businessId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('customers')
        .select('id, name, segment, last_visit_at')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .in('segment', ['risk', 'lost'])
        .order('last_visit_at', { ascending: true })
        .limit(5),

      supabase
        .from('appointments')
        .select('appointment_date, start_time')
        .eq('business_id', businessId)
        .gte('appointment_date', sevenAgo)
        .lte('appointment_date', today)
        .is('deleted_at', null),

      supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('business_id', businessId)
        .gte('created_at', sevenAgoISO),

      // Haftalık randevular
      supabase
        .from('appointments')
        .select('appointment_date, status')
        .eq('business_id', businessId)
        .gte('appointment_date', weekStartStr)
        .lte('appointment_date', weekEndStr)
        .is('deleted_at', null)
        .not('status', 'eq', 'cancelled'),
    ])

    todayAppointments = (results[0].data ?? []) as TodayAppointmentRow[]
    stats = (results[1].data ?? null) as BusinessStatsView | null
    notifications = (results[2].data ?? []) as NotificationRow[]
    riskCustomers = (results[3].data ?? []) as RiskCustomerRow[]

    const dateRows = (results[4].data ?? []) as DateOnlyAppointment[]
    const reviewRows = (results[5].data ?? []) as ReviewSummary[]
    aptTrend = dailyCounts(dateRows.map((r) => r.appointment_date), d7)
    ratingTrend = dailyAverages(
      reviewRows.map((r) => ({
        day: r.created_at?.split('T')[0],
        value: r.rating ?? 0,
      })),
      d7,
    )
    weeklyAppointments = (results[6].data ?? []) as WeekAppointmentRow[]
  } catch (err) {
    console.error('Dashboard veri çekme hatası:', err)
  }

  // Saatlik yoğunluk (bugünkü randevular)
  const hourlyDensity: number[] = Array.from({ length: 12 }, (_, i) => {
    const hour = i + 8 // 08:00 - 19:00
    return todayAppointments.filter(a => {
      const h = parseInt(a.start_time?.split(':')[0] || '0')
      return h === hour
    }).length
  })
  const hourLabels = Array.from({ length: 12 }, (_, i) => `${String(i + 8).padStart(2, '0')}:00`)

  // Haftalık gün bazlı dağılım
  const weekDayNames = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
  const weeklyByDay: number[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const ds = d.toISOString().split('T')[0]
    return weeklyAppointments.filter((a) => a.appointment_date === ds).length
  })

  const s = {
    total_customers: stats?.total_customers ?? 0,
    today_appointments: stats?.today_appointments ?? 0,
    today_completed: stats?.today_completed ?? 0,
    today_no_shows: stats?.today_no_shows ?? 0,
    total_reviews: stats?.total_reviews ?? 0,
    avg_rating: stats?.avg_rating ?? null,
    unread_notifications: stats?.unread_notifications ?? 0,
  }

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${businessId}`
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${businessId}`
  // İşletme sahibi/personeli için önizleme linki — OTP/telefon girişi atlanır,
  // aktif bir müşteri olarak portala doğrudan girilir.
  const portalPreviewUrl = `/api/portal/owner-preview?businessId=${businessId}`
  const firstName = staff.name?.split(' ')[0] || 'Hoş geldiniz'

  return (
    <div className="space-y-6">
      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-50">
            Merhaba, {firstName} 👋
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bugünkü Randevu"
          value={s.today_appointments}
          subtitle={`${s.today_completed} tamamlandı`}
          icon={<Calendar className="h-5 w-5" />}
          gradient="from-blue-500 to-indigo-600"
          bgLight="bg-blue-50 dark:bg-blue-950/40"
          iconBg="bg-blue-500/10 dark:bg-blue-500/20"
          iconColor="text-blue-600 dark:text-blue-400"
          sparkline={<Sparkline data={hourlyDensity} color="#3b82f6" height={44} labels={hourLabels} unit=" randevu" />}
        />
        <StatCard
          title="Haftalık Randevu"
          value={weeklyAppointments.length}
          subtitle={`${weekDayNames[0]}–${weekDayNames[6]} aktif`}
          icon={<Calendar className="h-5 w-5" />}
          gradient="from-emerald-500 to-teal-600"
          bgLight="bg-emerald-50 dark:bg-emerald-950/40"
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          sparkline={<Sparkline data={weeklyByDay} color="#10b981" height={44} labels={weekDayNames} unit=" randevu" />}
        />
        <StatCard
          title="Ortalama Puan"
          value={s.avg_rating ? `${Number(s.avg_rating).toFixed(1)} ★` : '—'}
          subtitle={`${s.total_reviews} yorum`}
          icon={<Star className="h-5 w-5" />}
          gradient="from-amber-500 to-orange-600"
          bgLight="bg-amber-50 dark:bg-amber-950/40"
          iconBg="bg-amber-500/10 dark:bg-amber-500/20"
          iconColor="text-amber-600 dark:text-amber-400"
          sparkline={<Sparkline data={ratingTrend} color="#f59e0b" height={44} labels={dayKeys(d7).map(d => format(new Date(d), 'dd MMM'))} />}
          trend={getTrend(ratingTrend)}
        />
        <StatCard
          title={`Riskli ${customerLabelPlural}`}
          value={riskCustomers.length}
          subtitle={riskCustomers.length > 0 ? 'dikkat gerektiren' : 'sorun yok'}
          icon={<AlertTriangle className="h-5 w-5" />}
          gradient={riskCustomers.length > 0 ? 'from-rose-500 to-pink-600' : 'from-gray-400 to-gray-500'}
          bgLight={riskCustomers.length > 0 ? 'bg-rose-50 dark:bg-rose-950/40' : 'bg-gray-50 dark:bg-gray-900/40'}
          iconBg={riskCustomers.length > 0 ? 'bg-rose-500/10 dark:bg-rose-500/20' : 'bg-gray-500/10 dark:bg-gray-500/20'}
          iconColor={riskCustomers.length > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}
        />
      </div>

      {/* ── Onboarding (yeni işletme) ── */}
      {s.total_customers === 0 && s.today_appointments === 0 && (
        <OnboardingCard bookingUrl={bookingUrl} customerLabel={customerLabel} customerLabelPlural={customerLabelPlural} />
      )}

      {/* ── Ana içerik (sade varsayılan görünüm) ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bugünkü randevular */}
        <div className="lg:col-span-2">
          <TodayAppointments appointments={todayAppointments} />
        </div>

        {/* Sağ sütun: bildirim + AI günlük özeti */}
        <div className="space-y-5">
          {/* Bildirimler */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Bildirimler</h2>
                {notifications.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                    {notifications.length}
                  </span>
                )}
              </div>
              <a href="/dashboard/notifications" className="text-xs font-medium text-pulse-900 dark:text-pulse-400 hover:underline">
                Tümünü gör →
              </a>
            </div>
            {!notifications || notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Bell className="h-8 w-8 text-gray-200 dark:text-gray-700 mb-2" />
                <p className="text-sm text-gray-400">Yeni bildirim yok</p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => {
                  const isNew = notif.created_at && (Date.now() - new Date(notif.created_at).getTime()) < 24 * 60 * 60 * 1000
                  const typeConfig = NOTIF_CONFIG[notif.type as keyof typeof NOTIF_CONFIG] || NOTIF_CONFIG.system
                  const notifHref = (notif.type === 'appointment' || notif.related_type === 'appointment') && notif.related_id
                    ? `/dashboard/appointments?appointmentId=${notif.related_id}`
                    : '/dashboard/notifications'
                  return (
                    <a key={notif.id} href={notifHref} className="flex gap-3 items-start group hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-lg p-1 -m-1 transition-colors">
                      <div className={`flex-shrink-0 flex h-8 w-8 items-center justify-center rounded-lg mt-0.5 ${typeConfig.bg}`}>
                        <typeConfig.Icon className={`h-4 w-4 ${typeConfig.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{notif.title}</p>
                          {isNew && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:text-blue-300 flex-shrink-0">
                              YENİ
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{notif.body}</p>
                      </div>
                    </a>
                  )
                })}
              </div>
            )}
          </div>

          {/* AI günlük özeti */}
          <AiBriefWidget businessId={businessId} />
        </div>
      </div>

      {/* ── Detaylar (opsiyonel) ── */}
      <DetailToggle storageKey="dashboard-details">
        {/* Online randevu linki */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pulse-900 to-indigo-600 px-5 py-4 shadow-lg shadow-pulse-900/20">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-0.5">
                Online Randevu Linkiniz
              </p>
              <p className="text-sm text-white/90 truncate font-mono">{bookingUrl}</p>
            </div>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-2 text-xs font-semibold text-white transition-colors backdrop-blur-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Aç
            </a>
          </div>
        </div>

        {/* Müşteri portalı */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-700 to-fuchsia-600 px-5 py-4 shadow-lg shadow-purple-900/20">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-10" />
          <div className="relative flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-0.5">
                Müşteri Self-Servis Portal
              </p>
              <p className="text-sm text-white/90 truncate font-mono">{portalUrl}</p>
              <p className="text-[11px] text-white/60 mt-0.5">
                Aç butonu — portalı mevcut bir müşteri olarak önizler.
              </p>
            </div>
            <a
              href={portalPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-3 py-2 text-xs font-semibold text-white transition-colors backdrop-blur-sm"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Aç
            </a>
          </div>
        </div>

        {/* Performans + haftalık + AI kampanya + risk */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-5">
            <PerformanceStats />
            <WeeklyInsights />
          </div>
          <div className="space-y-5">
            <AiInsightsWidget />
            {riskCustomers && riskCustomers.length > 0 && (
              <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  </div>
                  <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                    Riskli {customerLabelPlural}
                  </h2>
                </div>
                <div className="space-y-2">
                  {riskCustomers.map((customer) => (
                    <div key={customer.id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{customer.name}</span>
                      <span className={`badge flex-shrink-0 text-xs ${
                        customer.segment === 'lost'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
                      }`}>
                        {SEGMENT_LABELS[customer.segment as keyof typeof SEGMENT_LABELS]}
                      </span>
                    </div>
                  ))}
                </div>
                <a
                  href="/dashboard/customers"
                  className="mt-3 block text-center text-xs font-medium text-amber-700 dark:text-amber-400 hover:underline"
                >
                  {customerLabelPlural} sayfasına git →
                </a>
              </div>
            )}
          </div>
        </div>
      </DetailToggle>
    </div>
  )
}

// ── Onboarding Card ──
function OnboardingCard({ bookingUrl, customerLabel, customerLabelPlural }: { bookingUrl: string; customerLabel: string; customerLabelPlural: string }) {
  const steps = [
    {
      icon: <Scissors className="h-5 w-5" />,
      iconBg: 'bg-pulse-900/10',
      iconColor: 'text-pulse-900 dark:text-pulse-400',
      title: 'Hizmetlerini Ekle',
      desc: 'Sunduğun hizmetleri ve fiyatları tanımla',
      href: '/dashboard/services',
    },
    {
      icon: <UserPlus className="h-5 w-5" />,
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-600 dark:text-emerald-400',
      title: `${customerLabel} Ekle`,
      desc: `İlk kaydını ekle veya randevu bağla`,
      href: '/dashboard/customers',
    },
    {
      icon: <Calendar className="h-5 w-5" />,
      iconBg: 'bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
      title: 'İlk Randevunu Oluştur',
      desc: 'Takvimini doldurmaya başla',
      href: '/dashboard/appointments',
    },
    {
      icon: <CreditCard className="h-5 w-5" />,
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-600 dark:text-amber-400',
      title: 'Online Randevu Linkini Paylaş',
      desc: `${customerLabelPlural} senden kolayca randevu alsın`,
      href: bookingUrl,
      external: true,
    },
  ]

  return (
    <div className="rounded-2xl border border-pulse-200/60 dark:border-pulse-900/40 bg-gradient-to-br from-pulse-50 to-indigo-50 dark:from-pulse-950/20 dark:to-indigo-950/20 p-5">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Başlamak için 4 adım</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">PulseApp&apos;i tam kapasite kullanmak için şu adımları tamamla</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <a
            key={i}
            href={step.href}
            target={step.external ? '_blank' : undefined}
            rel={step.external ? 'noopener noreferrer' : undefined}
            className="group flex items-center gap-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3.5 hover:border-pulse-300 dark:hover:border-pulse-700 hover:shadow-sm transition-all duration-150"
          >
            <div className={`flex-shrink-0 flex h-9 w-9 items-center justify-center rounded-xl ${step.iconBg}`}>
              <span className={step.iconColor}>{step.icon}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{step.title}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{step.desc}</p>
            </div>
            <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-600 flex-shrink-0 group-hover:text-pulse-900 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  )
}

// ── Notification type config ──
const NOTIF_CONFIG = {
  appointment: { Icon: Calendar, bg: 'bg-blue-50 dark:bg-blue-900/30', color: 'text-blue-500' },
  review:      { Icon: Star,     bg: 'bg-amber-50 dark:bg-amber-900/30', color: 'text-amber-500' },
  system:      { Icon: Bell,     bg: 'bg-gray-100 dark:bg-gray-800', color: 'text-gray-500' },
}

// ── Stat Card ──
function StatCard({
  title,
  value,
  subtitle,
  icon,
  gradient,
  bgLight,
  iconBg,
  iconColor,
  sparkline,
  trend,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  gradient: string
  bgLight: string
  iconBg: string
  iconColor: string
  sparkline?: React.ReactNode
  trend?: 'up' | 'down' | 'flat'
}) {
  return (
    <div className={`relative overflow-visible rounded-2xl border border-gray-100 dark:border-gray-800 ${bgLight} p-5 transition-all duration-200 hover:shadow-md cursor-default`}>
      <div className="flex items-start justify-between mb-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconBg}`}>
          <span className={iconColor}>{icon}</span>
        </div>
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${
            trend === 'up' ? 'text-emerald-600 dark:text-emerald-400' :
            trend === 'down' ? 'text-red-500 dark:text-red-400' :
            'text-gray-400'
          }`}>
            {trend === 'up' ? <TrendingUp className="h-3.5 w-3.5" /> :
             trend === 'down' ? <TrendingDown className="h-3.5 w-3.5" /> :
             <Minus className="h-3.5 w-3.5" />}
          </div>
        )}
      </div>

      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{title}</p>
      <p className={`text-3xl font-bold bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
        {value}
      </p>
      {subtitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
      )}

      {sparkline && (
        <div className="mt-3">
          {sparkline}
        </div>
      )}
    </div>
  )
}

// ── Helpers ──
function getTrend(data: number[]): 'up' | 'down' | 'flat' {
  if (!data || data.length < 2) return 'flat'
  const last = data.at(-1) ?? 0
  const prev = data.at(-2) ?? 0
  if (last > prev) return 'up'
  if (last < prev) return 'down'
  return 'flat'
}

function dayKeys(start: Date, days = 7): string[] {
  return Array.from({ length: days }, (_, i) => format(addDays(start, i), 'yyyy-MM-dd'))
}

function dailyCounts(dates: (string | undefined)[], start: Date): number[] {
  const counts: Record<string, number> = {}
  dates.forEach(d => { if (d) counts[d] = (counts[d] || 0) + 1 })
  return dayKeys(start).map(k => counts[k] || 0)
}

function dailyAverages(items: { day: string | undefined; value: number }[], start: Date): number[] {
  const grouped: Record<string, number[]> = {}
  items.forEach(({ day, value }) => {
    if (day) { grouped[day] = grouped[day] || []; grouped[day].push(value) }
  })
  return dayKeys(start).map(k => {
    const vals = grouped[k]
    return vals ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
  })
}
