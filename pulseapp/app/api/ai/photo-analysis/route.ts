import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/photo-analysis' })

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE_LIMITS.ai)
  if (rl.limited) return rl.response

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, imageUrl, title, category } = body

  if (!businessId || !imageUrl) {
    return NextResponse.json({ error: 'businessId ve imageUrl zorunlu' }, { status: 400 })
  }

  // Verify staff membership
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', user.id)
    .eq('business_id', businessId)
    .single()

  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const prompt = `Sen bir profesyonel görsel analiz uzmanısın. Aşağıdaki görseli analiz et ve değerlendir.

${title ? `Görsel Başlığı: ${title}` : ''}
${category ? `Kategori: ${category}` : ''}

Lütfen aşağıdaki başlıklar altında analiz yap:

1. **Genel Değerlendirme**: Görselin genel kalitesi ve profesyonelliği
2. **Teknik Analiz**: Işık, kompozisyon, renk dengesi
3. **İyileştirme Önerileri**: Daha iyi sonuç için öneriler
4. **Portfolyo Etkisi**: Bu görselin portfolyodaki etkisi ve müşteri çekme potansiyeli

Türkçe ve kısa, öz yanıt ver. Her başlık 2-3 cümle olsun.`

  try {
    const anthropic = getAnthropicClient()
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: imageUrl },
          },
          { type: 'text', text: prompt },
        ],
      }],
    })

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.type === 'text' ? block.text : '')
      .join('\n')

    return NextResponse.json({ analysis: responseText })
  } catch (err) {
    log.error({ err }, 'AI fotoğraf analizi hatası')
    return NextResponse.json({ error: 'AI analizi yapılamadı' }, { status: 500 })
  }
}
