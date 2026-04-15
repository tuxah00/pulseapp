import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeInsightsSummary } from '@/lib/analytics/insights'
import type { SectorType } from '@/types'

// GET: İş Zekası sayfası için atomik özet verisi
// Hem KPI hem marjin/kohort/mevsimsel/öneri bir seferde döner.
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

  // Sektör bilgisi (öneriler + mevsimsel bağlam için gerekli)
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
    const summary = await computeInsightsSummary(admin, businessId, sector, { from, to })
    return NextResponse.json(summary)
  } catch (err: any) {
    console.error('[insights/summary] compute error:', err)
    return NextResponse.json(
      { error: err?.message || 'İçgörü hesaplanamadı' },
      { status: 500 },
    )
  }
}
