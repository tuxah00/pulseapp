import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getOpenAIClient, CLASSIFY_MODEL, DEFAULT_MAX_TOKENS } from '@/lib/ai/openai-client'
import { getClassifySystemPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import type { AiClassification } from '@/types'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/classify' })

const VALID_CLASSIFICATIONS: AiClassification[] = [
  'appointment', 'question', 'complaint', 'cancellation', 'greeting', 'other',
]

export async function POST(request: NextRequest) {
  try {
    // Rate limit kontrolü (AI endpoint'ler: 10 req/min)
    const rl = checkRateLimit(request, RATE_LIMITS.ai)
    if (rl.limited) return rl.response

    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { message, businessId, messageId } = body

    if (!message || !businessId) {
      return NextResponse.json({ error: 'message ve businessId gerekli' }, { status: 400 })
    }

    const { data: business } = await supabase
      .from('businesses')
      .select('name, sector')
      .eq('id', businessId)
      .single()

    if (!business) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const client = getOpenAIClient()
    const systemPrompt = getClassifySystemPrompt(business.sector, business.name)

    const response = await client.chat.completions.create({
      model: CLASSIFY_MODEL,
      max_tokens: DEFAULT_MAX_TOKENS,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content || ''

    let result: { classification: AiClassification; confidence: number; summary: string }
    try {
      result = JSON.parse(text)
      if (!VALID_CLASSIFICATIONS.includes(result.classification)) {
        result.classification = 'other'
      }
      result.confidence = Math.max(0, Math.min(1, result.confidence || 0.5))
    } catch {
      result = { classification: 'other', confidence: 0.3, summary: 'Sınıflandırılamadı' }
    }

    if (messageId) {
      await supabase
        .from('messages')
        .update({
          ai_classification: result.classification,
          ai_confidence: result.confidence,
        })
        .eq('id', messageId)
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    log.error({ err: error }, 'AI classify hatası')
    return NextResponse.json(
      { error: 'AI sınıflandırma hatası', details: message },
      { status: 500 }
    )
  }
}
