import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'
import { getOpenAIClient, VISION_MODEL, VISION_MAX_TOKENS } from '@/lib/ai/openai-client'
import { getPhotoAnalysisPrompt } from '@/lib/ai/photo-prompts'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { aiBeforeAfterSchema } from '@/lib/schemas'
import type { SectorType } from '@/types'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/before-after' })

// POST: Öncesi/Sonrası karşılaştırma
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.ai)
  if (rl.limited) return rl.response

  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const parsed = await validateBody(req, aiBeforeAfterSchema)
  if (!parsed.ok) return parsed.response
  const { beforeUrl, afterUrl, customerId, protocolId } = parsed.data

  const supabase = createServerSupabaseClient()

  // İşletmenin sektörünü al
  const { data: business } = await supabase
    .from('businesses')
    .select('sector')
    .eq('id', businessId)
    .single()

  const sector = (business?.sector || null) as SectorType | null
  const systemPrompt = getPhotoAnalysisPrompt(sector, 'before_after')

  // Protokol bilgisi varsa ek bağlam ekle
  let protocolContext = ''
  if (protocolId) {
    const { data: protocol } = await supabase
      .from('treatment_protocols')
      .select('name, total_sessions, completed_sessions, service:services(name)')
      .eq('id', protocolId)
      .single()
    if (protocol) {
      const svc = Array.isArray(protocol.service) ? protocol.service[0] : protocol.service
      protocolContext = `\n\nProtokol: ${protocol.name} (${(svc as { name: string } | null)?.name || '?'}) — ${protocol.completed_sessions}/${protocol.total_sessions} seans tamamlandı.`
    }
  }

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: VISION_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Birinci fotoğraf (TEDAVİ ÖNCESİ):' },
            { type: 'image_url', image_url: { url: beforeUrl } },
            { type: 'text', text: 'İkinci fotoğraf (TEDAVİ SONRASI):' },
            { type: 'image_url', image_url: { url: afterUrl } },
            { type: 'text', text: systemPrompt + protocolContext },
          ],
        },
      ],
    })

    const analysis = completion.choices[0]?.message?.content || ''

    return NextResponse.json({
      analysis,
      sector,
      customerId: customerId || null,
      protocolId: protocolId || null,
    })
  } catch (err: unknown) {
    log.error({ err }, 'AI before-after analizi hatası')
    const message = err instanceof Error ? err.message : 'Analiz yapılamadı'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
