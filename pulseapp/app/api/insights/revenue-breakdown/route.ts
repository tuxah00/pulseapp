import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveDateRange } from '@/lib/insights/date-range'
import { generateInsight } from '@/lib/insights/generate'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/insights/revenue-breakdown' })

/**
 * GET /api/insights/revenue-breakdown?businessId=&days=30
 *
 * Gelir dağılımını (hizmet / ürün / paket / diğer) ve InsightBlock
 * önerisini birlikte döndürür. Panel sol kolonda pasta grafiği,
 * sağ kolonda metni + aksiyon butonlarını bu response'a göre çizer.
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const range = resolveDateRange(searchParams)
  const admin = createAdminClient()

  try {
    // Ödenmiş veya kısmi ödenmiş faturalar — gerçekleşen cironun en iyi kaynağı.
    const [invoicesRes, incomeRes] = await Promise.all([
      admin
        .from('invoices')
        .select('id, total, paid_amount, status, items, created_at')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('status', ['paid', 'partial'])
        .gte('created_at', range.fromIso)
        .lte('created_at', range.toIso),
      admin
        .from('income')
        .select('id, category, amount, income_date')
        .eq('business_id', businessId)
        .gte('income_date', range.from)
        .lte('income_date', range.to),
    ])

    if (invoicesRes.error) throw invoicesRes.error
    if (incomeRes.error) throw incomeRes.error

    // Kalem bazlı gruplama: service / product / package / other
    const buckets = new Map<string, number>()
    const addBucket = (label: string, amount: number) => {
      if (!Number.isFinite(amount) || amount <= 0) return
      buckets.set(label, (buckets.get(label) ?? 0) + amount)
    }

    for (const inv of invoicesRes.data ?? []) {
      const items = Array.isArray(inv.items) ? inv.items : []
      if (items.length === 0) {
        // Kalemsiz fatura → paid_amount fallback
        addBucket('Hizmet', Number(inv.paid_amount ?? inv.total ?? 0))
        continue
      }
      for (const raw of items) {
        const it = raw as {
          type?: 'service' | 'product' | 'package'
          total?: number
          price?: number
          quantity?: number
        }
        const amount =
          Number(it.total ?? (Number(it.price ?? 0) * Number(it.quantity ?? 1))) || 0
        const label =
          it.type === 'product'
            ? 'Ürün'
            : it.type === 'package'
              ? 'Paket'
              : 'Hizmet'
        addBucket(label, amount)
      }
    }

    for (const row of incomeRes.data ?? []) {
      addBucket(row.category || 'Manuel Gelir', Number(row.amount ?? 0))
    }

    const slices = Array.from(buckets.entries())
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
    const totalRevenue = slices.reduce((s, x) => s + x.amount, 0)

    const insight = generateInsight('revenue', { slices, totalRevenue })

    return NextResponse.json({
      range: { from: range.from, to: range.to, days: range.days },
      totals: { revenue: totalRevenue },
      slices,
      insight,
    })
  } catch (err) {
    log.error({ err, businessId }, 'revenue-breakdown error')
    return NextResponse.json(
      { error: 'Gelir dağılımı hesaplanamadı' },
      { status: 500 },
    )
  }
}
