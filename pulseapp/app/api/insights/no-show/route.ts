import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/no-show' })

/**
 * GET /api/insights/no-show?businessId=&days=30
 *
 * No-show (gelmedi) oranı + onay SMS durumu + riskli müşteri sayısı +
 * en yüksek no-show'lu personel. Hepsi bir InsightBlock üretir.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    const [appointmentsRes, businessRes, riskyCustRes, staffRes] = await Promise.all([
      admin
        .from('appointments')
        .select('id, status, staff_id, appointment_date')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['completed', 'no_show', 'cancelled'])
        .gte('appointment_date', range.from)
        .lte('appointment_date', range.to),
      admin
        .from('businesses')
        .select('settings')
        .eq('id', businessId)
        .maybeSingle(),
      admin
        .from('customers')
        .select('id')
        .eq('business_id', businessId)
        .gt('no_show_score', 40),
      admin
        .from('staff_members')
        .select('id, name')
        .eq('business_id', businessId)
        .eq('is_active', true),
    ])

    if (appointmentsRes.error) throw appointmentsRes.error
    if (businessRes.error) throw businessRes.error
    if (riskyCustRes.error) throw riskyCustRes.error

    const staffNameMap = new Map<string, string>(
      (staffRes.data ?? []).map((s) => [s.id as string, s.name as string])
    )

    const all = appointmentsRes.data ?? []
    // Payda: no-show sayımı için tamamlanan + no-show toplamı mantıklı
    // (iptal'ler oran dışı bırakılır çünkü personel/müşteri kusuru olmayabilir).
    const relevant = all.filter((a) => a.status === 'completed' || a.status === 'no_show')
    const totalAppointments = relevant.length
    const totalNoShows = relevant.filter((a) => a.status === 'no_show').length
    const noShowRate = totalAppointments > 0 ? totalNoShows / totalAppointments : 0

    // Personel kırılımı
    const staffStats = new Map<
      string,
      { staffName: string; total: number; noShows: number }
    >()
    for (const a of relevant) {
      const key = (a.staff_id as string | null) || '__unassigned__'
      const name = (a.staff_id && staffNameMap.get(a.staff_id as string)) || 'Atanmamış'
      const s = staffStats.get(key) ?? { staffName: name, total: 0, noShows: 0 }
      s.total += 1
      if (a.status === 'no_show') s.noShows += 1
      staffStats.set(key, s)
    }
    const staffBreakdown = Array.from(staffStats.values())
      .filter((s) => s.total >= 5)
      .map((s) => ({
        staffName: s.staffName,
        total: s.total,
        noShows: s.noShows,
        rate: s.noShows / s.total,
      }))
      .sort((a, b) => b.rate - a.rate)

    const topStaffRate =
      staffBreakdown.length > 0 && staffBreakdown[0].rate > 0
        ? { staffName: staffBreakdown[0].staffName, rate: staffBreakdown[0].rate }
        : null

    const settings = (businessRes.data?.settings ?? {}) as {
      confirmation_sms_enabled?: boolean
    }
    const confirmationsEnabled = !!settings.confirmation_sms_enabled
    const riskyCustomerCount = (riskyCustRes.data ?? []).length

    const insight = generateInsight('no_show', {
      noShowRate,
      totalAppointments,
      totalNoShows,
      confirmationsEnabled,
      riskyCustomerCount,
      topStaffRate,
    })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals: {
        appointments: totalAppointments,
        noShows: totalNoShows,
        rate: noShowRate,
        riskyCustomers: riskyCustomerCount,
      },
      staffBreakdown,
      confirmationsEnabled,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'no-show error')
    return NextResponse.json(
      { error: 'No-show analizi hesaplanamadı' },
      { status: 500 },
    )
  }
}
