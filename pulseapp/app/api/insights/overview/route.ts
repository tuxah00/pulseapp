import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/overview' })

/**
 * GET /api/insights/overview?businessId=&days=30
 *
 * İş Zekası panelinin üst şerit KPI özeti. Tek atılışta dönecek hafif
 * rakamlar — detay bölümler kendi endpoint'lerinden gelir.
 *
 * Response:
 *  - totalRevenue: fatura ödenen + randevu/hizmet cirosu (range içinde)
 *  - totalExpense: gider toplamı (range içinde)
 *  - netProfit:    revenue - expense
 *  - appointmentsCompleted: tamamlanan randevu sayısı
 *  - appointmentsUpcoming:  bugün + önümüzdeki 7 gün pending/confirmed sayısı
 *  - customersTotal: işletme müşteri sayısı
 *  - customersNewInRange: range içinde oluşturulan müşteri sayısı
 *  - pendingActionsCount: ai_pending_actions kuyruğundaki açık öneri sayısı
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    const todayStr = new Date().toISOString().slice(0, 10)
    const upcomingTo = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)

    const [
      invoicesRes,
      incomeRes,
      expensesRes,
      appointmentsDoneRes,
      appointmentsUpcomingRes,
      customersTotalRes,
      customersNewRes,
      pendingActionsRes,
    ] = await Promise.all([
      // Ödenmiş/kısmi faturalar — range içinde
      admin
        .from('invoices')
        .select('paid_amount, total, status')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['paid', 'partial'])
        .gte('created_at', range.fromIso)
        .lte('created_at', range.toIso),
      // Manuel gelir kayıtları — range içinde
      admin
        .from('income')
        .select('amount')
        .eq('business_id', businessId)
        .gte('income_date', range.from)
        .lte('income_date', range.to),
      // Gider kayıtları — range içinde
      admin
        .from('expenses')
        .select('amount')
        .eq('business_id', businessId)
        .gte('expense_date', range.from)
        .lte('expense_date', range.to),
      // Tamamlanan randevular
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .eq('status', 'completed')
        .gte('appointment_date', range.from)
        .lte('appointment_date', range.to),
      // Yaklaşan randevular (bugün + 7 gün)
      admin
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['pending', 'confirmed'])
        .gte('appointment_date', todayStr)
        .lte('appointment_date', upcomingTo),
      // Toplam müşteri
      admin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId),
      // Range'te yeni müşteri
      admin
        .from('customers')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .gte('created_at', range.fromIso)
        .lte('created_at', range.toIso),
      // Açık pending action'lar (insights kaynaklı)
      admin
        .from('ai_pending_actions')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .in('status', ['pending', 'scheduled']),
    ])

    if (invoicesRes.error) throw invoicesRes.error
    if (incomeRes.error) throw incomeRes.error
    if (expensesRes.error) throw expensesRes.error

    const invoiceRevenue = (invoicesRes.data ?? []).reduce((s, inv) => {
      const amount = Number(inv.paid_amount ?? inv.total ?? 0)
      return Number.isFinite(amount) ? s + amount : s
    }, 0)
    const manualIncome = (incomeRes.data ?? []).reduce((s, row) => {
      const amount = Number(row.amount ?? 0)
      return Number.isFinite(amount) ? s + amount : s
    }, 0)
    const totalRevenue = invoiceRevenue + manualIncome

    const totalExpense = (expensesRes.data ?? []).reduce((s, row) => {
      const amount = Number(row.amount ?? 0)
      return Number.isFinite(amount) ? s + amount : s
    }, 0)

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals: {
        revenue: Math.round(totalRevenue),
        expense: Math.round(totalExpense),
        net: Math.round(totalRevenue - totalExpense),
      },
      appointments: {
        completed: appointmentsDoneRes.count ?? 0,
        upcoming: appointmentsUpcomingRes.count ?? 0,
      },
      customers: {
        total: customersTotalRes.count ?? 0,
        newInRange: customersNewRes.count ?? 0,
      },
      pendingActions: pendingActionsRes.count ?? 0,
    })
  } catch (err) {
    log.error({ err, businessId }, 'overview error')
    return NextResponse.json(
      { error: 'Özet hesaplanamadı' },
      { status: 500 },
    )
  }
}
