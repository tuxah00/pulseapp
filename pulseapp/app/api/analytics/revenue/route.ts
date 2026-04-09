import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'

// GET: Gelişmiş gelir analizi
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const groupBy = searchParams.get('groupBy') || 'period' // service | staff | period | customer_type
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  const admin = createAdminClient()

  // Temel fatura verisi
  let query = admin
    .from('invoices')
    .select('id, total, paid_amount, status, payment_method, staff_name, created_at, items, customer_id, customers(name, segment)')
    .eq('business_id', businessId)
    .in('status', ['paid', 'partial'])

  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to)

  const { data: invoices, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!invoices || invoices.length === 0) {
    return NextResponse.json({ breakdown: [], totals: { revenue: 0, count: 0, avgTicket: 0 } })
  }

  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.paid_amount || inv.total || 0), 0)
  const avgTicket = totalRevenue / invoices.length

  let breakdown: { label: string; revenue: number; count: number; percentage: number }[] = []

  if (groupBy === 'service') {
    const serviceMap = new Map<string, { revenue: number; count: number }>()
    for (const inv of invoices) {
      const items = (inv.items as { service_name: string; total: number }[]) || []
      for (const item of items) {
        const key = item.service_name || 'Diğer'
        const existing = serviceMap.get(key) || { revenue: 0, count: 0 }
        existing.revenue += item.total || 0
        existing.count += 1
        serviceMap.set(key, existing)
      }
    }
    breakdown = Array.from(serviceMap.entries()).map(([label, data]) => ({
      label,
      ...data,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
  } else if (groupBy === 'staff') {
    const staffMap = new Map<string, { revenue: number; count: number }>()
    for (const inv of invoices) {
      const key = inv.staff_name || 'Belirtilmemiş'
      const existing = staffMap.get(key) || { revenue: 0, count: 0 }
      existing.revenue += inv.paid_amount || inv.total || 0
      existing.count += 1
      staffMap.set(key, existing)
    }
    breakdown = Array.from(staffMap.entries()).map(([label, data]) => ({
      label,
      ...data,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
  } else if (groupBy === 'customer_type') {
    const typeMap = new Map<string, { revenue: number; count: number }>()
    for (const inv of invoices) {
      const customer = Array.isArray(inv.customers) ? inv.customers[0] : inv.customers
      const segment = (customer as { segment?: string })?.segment || 'unknown'
      const existing = typeMap.get(segment) || { revenue: 0, count: 0 }
      existing.revenue += inv.paid_amount || inv.total || 0
      existing.count += 1
      typeMap.set(segment, existing)
    }
    breakdown = Array.from(typeMap.entries()).map(([label, data]) => ({
      label,
      ...data,
      percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
    }))
  } else {
    // period — aylık gruplama
    const periodMap = new Map<string, { revenue: number; count: number }>()
    for (const inv of invoices) {
      const date = new Date(inv.created_at)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const existing = periodMap.get(key) || { revenue: 0, count: 0 }
      existing.revenue += inv.paid_amount || inv.total || 0
      existing.count += 1
      periodMap.set(key, existing)
    }
    breakdown = Array.from(periodMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([label, data]) => ({
        label,
        ...data,
        percentage: totalRevenue > 0 ? (data.revenue / totalRevenue) * 100 : 0,
      }))
  }

  breakdown.sort((a, b) => b.revenue - a.revenue)

  return NextResponse.json({
    breakdown,
    totals: { revenue: totalRevenue, count: invoices.length, avgTicket },
  })
}
