import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import {
  Calendar,
  Users,
  Star,
  AlertTriangle,
  Clock,
  Bell,
} from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { SEGMENT_LABELS } from '@/types'
import TodayAppointments from './_components/today-appointments'
import WeeklyInsights from './_components/weekly-insights'
import PerformanceStats from './_components/performance-stats'

export default async function DashboardPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // İşletme bilgisini al
  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id, name')
    .eq('user_id', user.id)
    .single()

  if (!staff) redirect('/auth/register')
  const businessId = staff.business_id

  // Paralel sorgular
  const today = new Date().toISOString().split('T')[0]

  let todayAppointments: any[] = []
  let stats: any = null
  let recentReviews: any[] = []
  let notifications: any[] = []
  let riskCustomers: any[] = []

  try {
    const results = await Promise.all([
      supabase
        .from('appointments')
        .select('*, customers(name, phone), services(name, duration_minutes), staff_members(name)')
        .eq('business_id', businessId)
        .eq('appointment_date', today)
        .order('start_time'),
      
      supabase
        .from('business_stats')
        .select('*')
        .eq('business_id', businessId)
        .single(),

      supabase
        .from('reviews')
        .select('*, customers(name)')
        .eq('business_id', businessId)
        .order('created_at', { ascending: false })
        .limit(5),

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
    ])

    todayAppointments = results[0].data || []
    stats = results[1].data
    recentReviews = results[2].data || []
    notifications = results[3].data || []
    riskCustomers = results[4].data || []
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

  return (
    <div>
      {/* Sayfa başlığı */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Merhaba, {staff.name?.split(' ')[0]} 👋
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          İşletmenizin bugünkü durumu
        </p>
      </div>

      {/* İstatistik kartları */}
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Bugünkü Randevu"
          value={s.today_appointments}
          subtitle={`${s.today_completed} tamamlandı`}
          icon={<Calendar className="h-5 w-5" />}
          color="blue"
        />
        <StatCard
          title="Toplam Müşteri"
          value={s.total_customers}
          icon={<Users className="h-5 w-5" />}
          color="green"
        />
        <StatCard
          title="Ortalama Puan"
          value={s.avg_rating ? `${s.avg_rating} ★` : '—'}
          subtitle={`${s.total_reviews} yorum`}
          icon={<Star className="h-5 w-5" />}
          color="amber"
        />
        <StatCard
          title="Bildirimler"
          value={s.unread_notifications}
          subtitle="okunmamış"
          icon={<Bell className="h-5 w-5" />}
          color={s.unread_notifications > 0 ? 'red' : 'gray'}
        />
      </div>

      {/* Online randevu linki */}
      <div className="mb-6 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-blue-800 mb-0.5">Online Randevu Linkiniz</p>
          <p className="text-xs text-blue-600 truncate font-mono">
            {process.env.NEXT_PUBLIC_APP_URL}/book/{businessId}
          </p>
        </div>
        <a
          href={`${process.env.NEXT_PUBLIC_APP_URL}/book/${businessId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
        >
          Aç
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bugünkü randevular */}
        <div className="lg:col-span-2">
          <TodayAppointments appointments={todayAppointments} />
        </div>

        {/* Sağ panel */}
        <div className="space-y-6">
          {/* Son bildirimler */}
          <div className="card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Bildirimler</h2>
              <a href="/dashboard/notifications" className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
                Tümünü gör →
              </a>
            </div>
            {!notifications || notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Yeni bildirim yok</p>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif: any) => {
                  const isNew = notif.created_at && (Date.now() - new Date(notif.created_at).getTime()) < 24 * 60 * 60 * 1000
                  return (
                    <div key={notif.id} className="flex gap-3 items-start">
                      <div className="mt-1.5 flex-shrink-0 relative">
                        <span className="block h-2 w-2 rounded-full bg-blue-500" />
                      </div>
                      <div className="mt-0.5 flex-shrink-0">
                        {notif.type === 'review' ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : notif.type === 'appointment' ? (
                          <Clock className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Bell className="h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{notif.title}</p>
                          {isNew && (
                            <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex-shrink-0">
                              Yeni
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{notif.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Performans İstatistikleri */}
          <PerformanceStats />

          {/* Haftalık AI Raporu */}
          <WeeklyInsights />

          {/* Riskli müşteriler */}
          {riskCustomers && riskCustomers.length > 0 && (
            <div className="card border-amber-200 bg-amber-50/50">
              <h2 className="mb-3 text-sm font-semibold text-amber-800">
                ⚠️ Dikkat Gerektiren Müşteriler
              </h2>
              <div className="space-y-2">
                {riskCustomers.map((customer: any) => (
                  <div key={customer.id} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 truncate">{customer.name}</span>
                    <span className={`badge ${customer.segment === 'lost' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                      {SEGMENT_LABELS[customer.segment as keyof typeof SEGMENT_LABELS]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── İstatistik Kartı ──
function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
}: {
  title: string
  value: string | number
  subtitle?: string
  icon: React.ReactNode
  color: 'blue' | 'green' | 'amber' | 'red' | 'gray'
}) {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    amber: 'bg-amber-50 text-amber-600',
    red: 'bg-red-50 text-red-600',
    gray: 'bg-gray-50 text-gray-500',
  }

  return (
    <div className="card flex items-start gap-4">
      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}
