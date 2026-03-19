import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client'
import { getReviewResponseSystemPrompt } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  try {
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
  } catch (error: any) {
    console.error('AI review response hatası:', error)
    return NextResponse.json(
      { error: 'AI yanıt oluşturma hatası', details: error.message },
      { status: 500 }
    )
  }
}
