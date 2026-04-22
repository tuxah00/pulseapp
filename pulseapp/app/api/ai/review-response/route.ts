import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client'
import { getReviewResponseSystemPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/review-response' })

export async function POST(request: NextRequest) {
  try {
    // Rate limit (AI: 10 req/min)
    const rl = checkRateLimit(request, RATE_LIMITS.ai)
    if (rl.limited) return rl.response

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { reviewId, businessId, rating, comment, customerName } = body

    if (!businessId || rating === undefined) {
      return NextResponse.json({ error: 'businessId ve rating gerekli' }, { status: 400 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name, sector')
      .eq('id', businessId)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const client = getAnthropicClient()
    const systemPrompt = getReviewResponseSystemPrompt(business.sector, business.name)

    const userContent = [
      `Puan: ${rating}/5`,
      customerName ? `Müşteri: ${customerName}` : 'Müşteri: Anonim',
      comment ? `Yorum: "${comment}"` : 'Yorum yazılmamış, sadece puan verilmiş.',
      '',
      'Bu yoruma profesyonel bir yanıt yaz.',
    ].join('\n')

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const draft = response.content[0].type === 'text' ? response.content[0].text : ''

    if (reviewId) {
      await supabase
        .from('reviews')
        .update({ ai_response_draft: draft.trim() })
        .eq('id', reviewId)
    }

    return NextResponse.json({ draft: draft.trim() })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error({ err: error }, 'AI review response hatası')
    return NextResponse.json(
      { error: 'AI yanıt oluşturma hatası', details: message },
      { status: 500 }
    )
  }
}
