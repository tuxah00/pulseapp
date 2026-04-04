import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Calendar,
  Users,
  Star,
  AlertTriangle,
  Bell,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Copy,
} from 'lucide-react'
import { addDays, format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import { SEGMENT_LABELS } from '@/types'
import TodayAppointments from './_components/today-appointments'
import WeeklyInsights from './_components/weekly-insights'
import PerformanceStats from './_components/performance-stats'
import { Sparkline } from '@/components/ui/sparkline'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, name')
    .eq('user_id', user.id)
    .single()

  if (!staff) redirect('/auth/register')
  const businessId = staff.business_id

  const today = new Date().toISOString().split('T')[0]
  const d7 = new Date(); d7.setDate(d7.getDate() - 6)
  const sevenAgo = d7.toISOString().split('T')[0]
  const sevenAgoISO = d7.toISOString()

  let todayAppointments: any[] = []
  let stats: any = null
  let notifications: any[] = []
  let riskCustomers: any[] = []
  let aptTrend: number[] = []
  let custTrend: number[] = []
  let ratingTrend: number[] = []

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
        .select('*')
        .eq('business_id', businessId)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .in('segment', ['risk', 'lost'])
        .order('last_visit_at', { ascending: true })
        .limit(5),

      supabase
        .from('appointments')
        .select('appointment_date')
        .eq('business_id', businessId)
        .gte('appointment_date', sevenAgo)
        .lte('appointment_date', today)
        .is('deleted_at', null),

      supabase
        .from('customers')
        .select('created_at')
        .eq('business_id', businessId)
        .gte('created_at', sevenAgoISO),

      supabase
        .from('reviews')
        .select('rating, created_at')
        .eq('business_id', businessId)
        .gte('created_at', sevenAgoISO),
    ])

    todayAppointments = results[0].data || []
    stats = results[1].data
    notifications = results[2].data || []
    riskCustomers = results[3].data || []

    aptTrend = dailyCounts((results[4].data || []).map((r: any) => r.appointment_date), d7)
    custTrend = dailyCounts((results[5].data || []).map((r: any) => r.created_at?.split('T')[0]), d7)
    ratingTrend = dailyAverages((results[6].data || []).map((r: any) => ({ day: r.created_at?.split('T')[0], value: r.rating })), d7)
  } catch (err) {
    console.error('Dashboard veri çekme hatası:', err)
  }

  const s = stats || {
    total_customers: 0,
    today_appointments: 0,
    today_completed: 0,
    today_no_shows: 0,
    total_reviews: 0,
    avg_rating: null,
    unread_notifications: 0,
  }

  const bookingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/book/${businessId}`
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
          sparkline={<Sparkline data={aptTrend} color="#3b82f6" height={44} />}
          trend={getTrend(aptTrend)}
        />
        <StatCard
          title="Toplam Müşteri"
          value={s.total_customers}
          subtitle={custTrend.at(-1) ? `+${custTrend.at(-1)} bugün` : undefined}
          icon={<Users className="h-5 w-5" />}
          gradient="from-emerald-500 to-teal-600"
          bgLight="bg-emerald-50 dark:bg-emerald-950/40"
          iconBg="bg-emerald-500/10 dark:bg-emerald-500/20"
          iconColor="text-emerald-600 dark:text-emerald-400"
          sparkline={<Sparkline data={custTrend} color="#10b981" height={44} />}
          trend={getTrend(custTrend)}
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
          sparkline={<Sparkline data={ratingTrend} color="#f59e0b" height={44} />}
          trend={getTrend(ratingTrend)}
        />
        <StatCard
          title="Bildirimler"
          value={s.unread_notifications}
          subtitle="okunmamış"
          icon={<Bell className="h-5 w-5" />}
          gradient={s.unread_notifications > 0 ? 'from-rose-500 to-pink-600' : 'from-gray-400 to-gray-500'}
          bgLight={s.unread_notifications > 0 ? 'bg-rose-50 dark:bg-rose-950/40' : 'bg-gray-50 dark:bg-gray-900/40'}
          iconBg={s.unread_notifications > 0 ? 'bg-rose-500/10 dark:bg-rose-500/20' : 'bg-gray-500/10 dark:bg-gray-500/20'}
          iconColor={s.unread_notifications > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500 dark:text-gray-400'}
        />
      </div>

      {/* ── Online booking banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-pulse-600 to-indigo-600 px-5 py-4 shadow-lg shadow-pulse-500/20">
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

      {/* ── Main content grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Today's appointments */}
        <div className="lg:col-span-2">
          <TodayAppointments appointments={todayAppointments} />
        </div>

        {/* Right sidebar */}
        <div className="space-y-5">
          {/* Notifications */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Bildirimler</h2>
              <a href="/dashboard/notifications" className="text-xs font-medium text-pulse-600 dark:text-pulse-400 hover:underline">
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
                {notifications.map((notif: any) => {
                  const isNew = notif.created_at && (Date.now() - new Date(notif.created_at).getTime()) < 24 * 60 * 60 * 1000
                  const typeConfig = NOTIF_CONFIG[notif.type as keyof typeof NOTIF_CONFIG] || NOTIF_CONFIG.system
                  return (
                    <div key={notif.id} className="flex gap-3 items-start group">
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
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Performance stats */}
          <PerformanceStats />

          {/* Weekly AI insights */}
          <WeeklyInsights />

          {/* Risk customers */}
          {riskCustomers && riskCustomers.length > 0 && (
            <div className="relative overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                  Dikkat Gerektiren Müşteriler
                </h2>
              </div>
              <div className="space-y-2">
                {riskCustomers.map((customer: any) => (
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
                Müşterilere git →
              </a>
            </div>
          )}
        </div>
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
    <div className={`relative overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-800 ${bgLight} p-5 transition-all duration-200 hover:shadow-md hover:-translate-y-0.5`}>
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
        <div className="mt-3 -mx-1">
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
