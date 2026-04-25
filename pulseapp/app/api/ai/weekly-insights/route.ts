import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { createLogger } from '@/lib/utils/logger'

export const dynamic = 'force-dynamic'

const log = createLogger({ route: 'api/ai/weekly-insights' })

interface InsightsResponse {
  period: string
  stats: {
    appointments: number
    new_customers: number
    risk_entered: number
    risk_exited: number
    weekly_revenue: number
  }
  generated_at: string
}

export async function GET(req: NextRequest) {
  try {
    const rl = checkRateLimit(req, RATE_LIMITS.ai)
    if (rl.limited) return rl.response

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

    const { data: staff } = await supabase
      .from('staff_members')
      .select('business_id')
      .eq('user_id', user.id)
      .single()

    if (!staff) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    const businessId = staff.business_id

    // Bu haftanın tarih aralığı (Pzt-Paz)
    const now = new Date()
    const dayOfWeek = now.getDay()
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() + mondayOffset)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekStart.getDate() + 6)
    weekEnd.setHours(23, 59, 59, 999)

    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]

    // Paralel sorgular
    const [apptRes, newCustRes, riskEnteredRes, riskExitedRes, revenueRes] = await Promise.all([
      // Bu haftaki tüm randevular (iptal hariç)
      supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('appointment_date', weekStartStr)
        .lte('appointment_date', weekEndStr)
        .is('deleted_at', null)
        .not('status', 'eq', 'cancelled'),

      // Bu hafta eklenen yeni müşteriler
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .gte('created_at', weekStart.toISOString()),

      // Bu hafta riskli/kayıp segmentine düşenler
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .in('segment', ['risk', 'lost'])
        .gte('updated_at', weekStart.toISOString()),

      // Bu hafta riskten çıkıp regular/vip'e dönenler
      supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('is_active', true)
        .in('segment', ['regular', 'vip'])
        .gte('updated_at', weekStart.toISOString())
        .gt('total_visits', 1),

      // Bu haftaki tamamlanan randevuların geliri
      supabase
        .from('appointments')
        .select('services(price)')
        .eq('business_id', businessId)
        .gte('appointment_date', weekStartStr)
        .lte('appointment_date', weekEndStr)
        .eq('status', 'completed')
        .is('deleted_at', null),
    ])

    // Gelir toplamı
    const weeklyRevenue = ((revenueRes.data || []) as { services: { price?: number } | null }[])
      .reduce((sum, a) => sum + (a.services?.price || 0), 0)

    const periodStart = weekStart.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
    const periodEnd = weekEnd.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })

    const response: InsightsResponse = {
      period: `${periodStart} – ${periodEnd}`,
      stats: {
        appointments: apptRes.count || 0,
        new_customers: newCustRes.count || 0,
        risk_entered: riskEnteredRes.count || 0,
        risk_exited: riskExitedRes.count || 0,
        weekly_revenue: weeklyRevenue,
      },
      generated_at: new Date().toISOString(),
    }

    return NextResponse.json(response)
  } catch (err) {
    log.error({ err }, 'Weekly insights error')
    return NextResponse.json({ error: 'Rapor oluşturulamadı' }, { status: 500 })
  }
}
