import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { resolveActiveStaff } from '@/lib/auth/active-business'
import {
  Calendar,
  AlertTriangle,
  Bell,
  ExternalLink,
  Scissors,
  CreditCard,
  UserPlus,
  ArrowRight,
  Star,
} from 'lucide-react'
import { cn, formatTime } from '@/lib/utils'
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

type TodayAppointmentRow = AppointmentRow & {
  customers: { name: string; phone: string | null } | null
  services: { name: string; duration_minutes: number } | null
  staff_members: { name: string } | null
}

type RiskCustomerRow = Pick<CustomerRow, 'id' | 'name' | 'segment' | 'last_visit_at'>
type WeekAppointmentRow = Pick<AppointmentRow, 'appointment_date' | 'status'>

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Aktif işletme cookie'sine göre doğru staff kaydını çöz (multi-business destek).
  // Layout `needs_selection` durumunu zaten yakalayıp picker'a yönlendirir;
  // burada yalnızca active ve needs_onboarding senaryoları kalır.
  const result = await resolveActiveStaff(supabase, user.id, 'business_id, name, businesses(sector)')
  if (result.status !== 'active' || !result.staffMember) redirect('/auth/register')
  const staff = result.staffMember
  const businessId = staff.business_id
  const sector = ((staff as unknown as { businesses: { sector?: string } }).businesses?.sector || 'other') as SectorType
  const customerLabelPlural = getCustomerLabel(sector)
  const customerLabel = getCustomerLabelSingular(sector)

  const today = new Date().toISOString().split('T')[0]

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
    weeklyAppointments = (results[4].data ?? []) as WeekAppointmentRow[]
  } catch (err) {
    console.error('Dashboard veri çekme hatası:', err)
  }

  const s = {
    total_customers: stats?.total_customers ?? 0,
    today_appointments: stats?.today_appointments ?? 0,
    today_completed: stats?.today_completed ?? 0,
    today_no_shows: stats?.today_no_shows ?? 0,
    total_reviews: stats?.total_reviews ?? 0,
    avg_rating: stats?.avg_rating ?? null,
    unread_notifications: stats?.unread_notifications ?? 0,
  }

  // ── Crew briefing — bir sonraki upcoming randevu ──
  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes()
  const upcoming = todayAppointments.find((a) => {
    if (!a.start_time) return false
    if (a.status === 'completed' || a.status === 'cancelled' || a.status === 'no_show') return false
    const [h, m] = a.start_time.split(':').map(Number)
    return h * 60 + m >= nowMinutes
  })
  const pendingConfirm = todayAppointments.filter((a) => a.status === 'pending').length

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${businessId}`
  const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL}/portal/${businessId}`
  // İşletme sahibi/personeli için önizleme linki — OTP/telefon girişi atlanır,
  // aktif bir müşteri olarak portala doğrudan girilir.
  const portalPreviewUrl = `/api/portal/owner-preview?businessId=${businessId}`
  const firstName = staff.name?.split(' ')[0] || 'Hoş geldiniz'

  return (
    <div className="space-y-6">
      {/* ── Crew briefing header ── */}
      <header className="flex flex-col gap-3 border-b border-gray-200 dark:border-gray-800 pb-5 sm:flex-row sm:items-baseline sm:justify-between">
        <div className="flex items-baseline gap-3">
          <h1 className="h-page">{firstName}</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        </div>
        <BriefingLine
          todayCount={s.today_appointments}
          completed={s.today_completed}
          upcoming={upcoming}
          pendingConfirm={pendingConfirm}
        />
      </header>

      {/* ── Dense KPI strip (Linear/Stripe tarzı) ── */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-200 dark:bg-gray-800 sm:grid-cols-4">
        <KPIItem
          label="Bugün"
          value={s.today_appointments}
          meta={`${s.today_completed} tamam · ${s.today_no_shows} gelmedi`}
        />
        <KPIItem
          label="Bu Hafta"
          value={weeklyAppointments.length}
          meta="randevu"
        />
        <KPIItem
          label="Puan"
          value={s.avg_rating ? Number(s.avg_rating).toFixed(1) : '—'}
          meta={`${s.total_reviews} yorum`}
          icon={s.avg_rating ? <Star className="h-3 w-3 fill-amber-400 text-amber-400" /> : null}
        />
        <KPIItem
          label={`Riskli ${customerLabelPlural}`}
          value={riskCustomers.length}
          meta={riskCustomers.length > 0 ? 'dikkat gerektiren' : 'sorun yok'}
          tone={riskCustomers.length > 0 ? 'warn' : 'muted'}
        />
      </div>

      {/* ── Onboarding (yeni işletme) ── */}
      {s.total_customers === 0 && s.today_appointments === 0 && (
        <OnboardingCard bookingUrl={bookingUrl} customerLabel={customerLabel} customerLabelPlural={customerLabelPlural} />
      )}

      {/* ── Ana içerik — 2/3 randevular + 1/3 bildirim/risk ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sol: Bugünkü randevular */}
        <div className="lg:col-span-2">
          <TodayAppointments appointments={todayAppointments} />
        </div>

        {/* Sağ: bildirim + riskli müşteri + haftalık rapor */}
        <div className="space-y-5">
          {/* Bildirimler */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="h-sub">Bildirimler</h2>
                {notifications.length > 0 && (
                  <span className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold tabular-nums">
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
                            <span className="badge-info text-[10px] font-semibold flex-shrink-0">
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

          {/* Riskli müşteriler */}
          {riskCustomers && riskCustomers.length > 0 && (
            <div className="card">
              <div className="mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <h2 className="h-sub">
                  Riskli {customerLabelPlural}
                </h2>
              </div>
              <div className="space-y-2">
                {riskCustomers.map((customer) => (
                  <div key={customer.id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{customer.name}</span>
                    <span className={cn('flex-shrink-0 text-xs', customer.segment === 'lost' ? 'badge-danger' : 'badge-warning')}>
                      {SEGMENT_LABELS[customer.segment as keyof typeof SEGMENT_LABELS]}
                    </span>
                  </div>
                ))}
              </div>
              <a
                href="/dashboard/customers"
                className="mt-3 block text-center text-xs font-medium text-pulse-900 dark:text-pulse-400 hover:underline"
              >
                {customerLabelPlural} sayfasına git →
              </a>
            </div>
          )}

          {/* Haftalık Rapor */}
          <WeeklyInsights />
        </div>
      </div>

      {/* Link kartları — footer (kompakt paylaşım) */}
      <div className="grid gap-3 sm:grid-cols-2">
        <ShareLink
          label="Online Randevu"
          url={bookingUrl}
          openHref={bookingUrl}
          icon={<Calendar className="h-4 w-4 text-pulse-900 dark:text-pulse-400" />}
          iconBg="bg-pulse-50 dark:bg-pulse-900/20"
        />
        <ShareLink
          label="Müşteri Portalı"
          url={portalUrl}
          openHref={portalPreviewUrl}
          icon={<UserPlus className="h-4 w-4 text-gray-600 dark:text-gray-400" />}
          iconBg="bg-gray-50 dark:bg-gray-800"
          hint="Önizle — mevcut müşteri olarak açar"
        />
      </div>
    </div>
  )
}

// ── Crew briefing status line ──
function BriefingLine({
  todayCount,
  completed,
  upcoming,
  pendingConfirm,
}: {
  todayCount: number
  completed: number
  upcoming: TodayAppointmentRow | undefined
  pendingConfirm: number
}) {
  if (todayCount === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Bugün randevu yok · <a href="/dashboard/appointments" className="font-medium text-pulse-900 dark:text-pulse-400 hover:underline">yeni randevu oluştur</a>
      </p>
    )
  }
  const remaining = todayCount - completed
  const parts: React.ReactNode[] = []
  parts.push(
    <span key="count" className="tabular-nums">
      <strong className="font-semibold text-gray-900 dark:text-gray-100">{remaining}</strong> randevu kaldı
    </span>,
  )
  if (upcoming) {
    parts.push(
      <span key="next" className="tabular-nums">
        Sonraki: <strong className="font-semibold text-gray-900 dark:text-gray-100">{formatTime(upcoming.start_time)}</strong> {upcoming.customers?.name || ''}
      </span>,
    )
  }
  if (pendingConfirm > 0) {
    parts.push(
      <span key="pending" className="tabular-nums text-amber-700 dark:text-amber-400">
        {pendingConfirm} onay bekliyor
      </span>,
    )
  }
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
      {parts.map((p, i) => (
        <span key={i} className="flex items-center gap-x-3">
          {i > 0 && <span className="text-gray-300 dark:text-gray-700">·</span>}
          {p}
        </span>
      ))}
    </p>
  )
}

// ── Dense KPI item (Linear/Stripe tarzı) ──
function KPIItem({
  label,
  value,
  meta,
  icon,
  tone = 'default',
}: {
  label: string
  value: string | number
  meta?: string
  icon?: React.ReactNode
  tone?: 'default' | 'warn' | 'muted'
}) {
  return (
    <div className="bg-white dark:bg-gray-900 px-4 py-3.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 truncate">
        {label}
      </p>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={cn(
          'text-2xl font-semibold tabular-nums',
          tone === 'warn' ? 'text-amber-700 dark:text-amber-400' :
          tone === 'muted' ? 'text-gray-400 dark:text-gray-500' :
          'text-gray-900 dark:text-gray-50',
        )}>
          {value}
        </span>
        {icon}
      </div>
      {meta && (
        <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500 truncate">{meta}</p>
      )}
    </div>
  )
}

// ── Paylaşım linki satırı ──
function ShareLink({
  label,
  url,
  openHref,
  icon,
  iconBg,
  hint,
}: {
  label: string
  url: string
  openHref: string
  icon: React.ReactNode
  iconBg: string
  hint?: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
        <p className="text-xs text-gray-700 dark:text-gray-300 truncate font-mono">{url}</p>
        {hint && <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">{hint}</p>}
      </div>
      <a
        href={openHref}
        target="_blank"
        rel="noopener noreferrer"
        className="flex-shrink-0 flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <ExternalLink className="h-3 w-3" />
        Aç
      </a>
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
    <div className="card">
      <div className="mb-4">
        <h2 className="h-sub">Başlamak için 4 adım</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">PulseApp&apos;i tam kapasite kullanmak için şu adımları tamamla</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {steps.map((step, i) => (
          <a
            key={i}
            href={step.href}
            target={step.external ? '_blank' : undefined}
            rel={step.external ? 'noopener noreferrer' : undefined}
            className="group flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 p-3.5 hover:border-pulse-300 dark:hover:border-pulse-700 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-all duration-150"
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
