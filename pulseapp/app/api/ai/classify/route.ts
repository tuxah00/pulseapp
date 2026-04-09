import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client'
import { getClassifySystemPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import type { AiClassification } from '@/types'

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

    const client = getAnthropicClient()
    const systemPrompt = getClassifySystemPrompt(business.sector, business.name)

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: message }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

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
  } catch (error: any) {
    console.error('AI classify hatası:', error)
    return NextResponse.json(
      { error: 'AI sınıflandırma hatası', details: error.message },
      { status: 500 }
    )
  }
}
