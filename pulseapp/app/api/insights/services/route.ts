import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import type { ServiceItem } from '@/lib/insights/templates'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/services' })

/**
 * GET /api/insights/services?businessId=&days=30
 *
 * Her hizmet için: seans sayısı, toplam ciro, ortalama bilet.
 * Bestseller / underperformer / hidden-gem şablonları bu veriye göre
 * değişir.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    // İki kaynak birleşir:
    // 1) Tamamlanan randevular — seans sayımı buradan gelir.
    // 2) Ödenen faturalar — ciro ve gerçekleşen tutar.
    const [servicesRes, appointmentsRes, invoicesRes] = await Promise.all([
      admin
        .from('services')
        .select('id, name, price')
        .eq('business_id', businessId)
        .eq('is_active', true),
      admin
        .from('appointments')
        .select('id, service_id, service_name, status, appointment_date')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['completed', 'confirmed'])
        .gte('appointment_date', range.from)
        .lte('appointment_date', range.to),
      admin
        .from('invoices')
        .select('id, paid_amount, total, items, status, created_at')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['paid', 'partial'])
        .gte('created_at', range.fromIso)
        .lte('created_at', range.toIso),
    ])

    if (servicesRes.error) throw servicesRes.error
    if (appointmentsRes.error) throw appointmentsRes.error
    if (invoicesRes.error) throw invoicesRes.error

    // service_id → { sessionCount, revenue, name, price }
    const byId = new Map<
      string,
      { id: string; name: string; sessionCount: number; revenue: number; price: number }
    >()
    const byName = new Map<
      string,
      { id: string; name: string; sessionCount: number; revenue: number; price: number }
    >()

    for (const s of servicesRes.data ?? []) {
      const row = {
        id: s.id,
        name: s.name,
        sessionCount: 0,
        revenue: 0,
        price: Number(s.price ?? 0),
      }
      byId.set(s.id, row)
      byName.set(s.name, row)
    }

    // Seans sayımı → randevu başına 1 seans
    for (const apt of appointmentsRes.data ?? []) {
      const row =
        (apt.service_id && byId.get(apt.service_id as string)) ||
        (apt.service_name && byName.get(apt.service_name as string))
      if (row) row.sessionCount += 1
    }

    // Ciro → fatura kalemlerinden
    for (const inv of invoicesRes.data ?? []) {
      const items = Array.isArray(inv.items) ? inv.items : []
      if (items.length === 0) continue
      for (const raw of items) {
        const it = raw as {
          type?: string
          service_id?: string
          service_name?: string
          name?: string
          total?: number
          price?: number
          quantity?: number
        }
        if (it.type && it.type !== 'service') continue
        const amount =
          Number(
            it.total ?? (Number(it.price ?? 0) * Number(it.quantity ?? 1)),
          ) || 0
        if (amount <= 0) continue
        const row =
          (it.service_id && byId.get(it.service_id)) ||
          (it.service_name && byName.get(it.service_name)) ||
          (it.name && byName.get(it.name))
        if (row) row.revenue += amount
      }
    }

    const services: ServiceItem[] = Array.from(byId.values())
      .map((s) => ({
        id: s.id,
        name: s.name,
        sessionCount: s.sessionCount,
        revenue: Math.round(s.revenue),
        avgTicket:
          s.sessionCount > 0 ? Math.round(s.revenue / s.sessionCount) : 0,
      }))
      .filter((s) => s.sessionCount > 0 || s.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)

    const totalRevenue = services.reduce((s, x) => s + x.revenue, 0)
    const insight = generateInsight('service', { services, totalRevenue })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals: { revenue: totalRevenue, serviceCount: services.length },
      services,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'services error')
    return NextResponse.json(
      { error: 'Hizmet analizi hesaplanamadı' },
      { status: 500 },
    )
  }
}
