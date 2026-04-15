import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeInsightsSummary } from '@/lib/analytics/insights'
import { fetchMacroContext } from '@/lib/analytics/macro-context'
import type { SectorType } from '@/types'

// GET: İş Zekası sayfası için atomik özet verisi
// KPI + operasyonel nabız + marj/kohort/mevsimsel/öneri + makro bağlam (kur + haftalık brief)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const now = new Date()
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1)
  const defaultTo = now

  const from = searchParams.get('from') || defaultFrom.toISOString().slice(0, 10)
  const to = searchParams.get('to') || defaultTo.toISOString().slice(0, 10)

  const admin = createAdminClient()

  const { data: business, error: bizErr } = await admin
    .from('businesses')
    .select('sector')
    .eq('id', businessId)
    .single()

  if (bizErr || !business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const sector = (business.sector as SectorType) || 'other'

  try {
    const [summary, macro] = await Promise.all([
      computeInsightsSummary(admin, businessId, sector, { from, to }),
      fetchMacroContext(admin, sector).catch(err => {
        console.error('[insights/summary] macro fetch failed:', err)
        return { snapshot: null, brief: null }
      }),
    ])
    return NextResponse.json({ ...summary, macro })
  } catch (err: any) {
    console.error('[insights/summary] compute error:', err)
    return NextResponse.json(
      { error: err?.message || 'İçgörü hesaplanamadı' },
      { status: 500 },
    )
  }
}
