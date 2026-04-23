import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/expense-breakdown' })

/**
 * GET /api/insights/expense-breakdown?businessId=&days=30
 *
 * Gider dağılımını kategori bazında döner + InsightBlock. totalRevenue
 * alanı şablon eşlemesinde "gider > gelir" kuralı için kullanılır.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    const [expensesRes, invoicesRes, incomeRes] = await Promise.all([
      admin
        .from('expenses')
        .select('id, category, amount, expense_date')
        .eq('business_id', businessId)
        .gte('expense_date', range.from)
        .lte('expense_date', range.to),
      admin
        .from('invoices')
        .select('paid_amount, total, status')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['paid', 'partial'])
        .gte('created_at', range.fromIso)
        .lte('created_at', range.toIso),
      admin
        .from('income')
        .select('amount')
        .eq('business_id', businessId)
        .gte('income_date', range.from)
        .lte('income_date', range.to),
    ])

    if (expensesRes.error) throw expensesRes.error
    if (invoicesRes.error) throw invoicesRes.error
    if (incomeRes.error) throw incomeRes.error

    const bucket = new Map<string, number>()
    for (const row of expensesRes.data ?? []) {
      const key = row.category || 'Diğer'
      const amount = Number(row.amount ?? 0)
      if (!Number.isFinite(amount) || amount <= 0) continue
      bucket.set(key, (bucket.get(key) ?? 0) + amount)
    }

    const slices = Array.from(bucket.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalExpense = slices.reduce((s, x) => s + x.amount, 0)

    const totalRevenue =
      (invoicesRes.data ?? []).reduce(
        (s, inv) => s + Number(inv.paid_amount ?? inv.total ?? 0),
        0,
      ) +
      (incomeRes.data ?? []).reduce(
        (s, inc) => s + Number(inc.amount ?? 0),
        0,
      )

    const insight = generateInsight('expense', {
      slices,
      totalExpense,
      totalRevenue,
    })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals: { expense: totalExpense, revenue: totalRevenue },
      slices,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'expense-breakdown error')
    return NextResponse.json(
      { error: 'Gider dağılımı hesaplanamadı' },
      { status: 500 },
    )
  }
}
