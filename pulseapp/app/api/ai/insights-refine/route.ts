import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { refineInsight } from '@/lib/insights/ai-refine'
import type { InsightBlock } from '@/lib/insights/types'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/insights-refine' })

/**
 * POST /api/ai/insights-refine
 *
 * Body: { block: InsightBlock, extra?: Record<string, string|number|boolean> }
 * Response: { text: string, cached: boolean }
 *
 * "AI ile detaylandır" butonu bu endpoint'i çağırır. Template metnini
 * 2-3 cümleye yeniden yazar; cache 1 saat geçerli.
 */
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const block = body.block as InsightBlock | undefined
  if (
    !block ||
    typeof block !== 'object' ||
    typeof block.template_key !== 'string' ||
    typeof block.title !== 'string' ||
    typeof block.message !== 'string' ||
    typeof block.category !== 'string'
  ) {
    return NextResponse.json(
      { error: 'block alanı geçerli bir InsightBlock olmalı' },
      { status: 400 },
    )
  }

  const extra = (body.extra ?? undefined) as
    | Record<string, string | number | boolean>
    | undefined

  try {
    const result = await refineInsight({ businessId, block, extra })
    return NextResponse.json(result)
  } catch (err) {
    log.error({ err, businessId }, 'insights-refine error')
    // Fallback — UI panelde orijinal metni göstermeye devam etsin
    return NextResponse.json({ text: block.message, cached: false })
  }
}
