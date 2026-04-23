import { NextRequest, NextResponse } from 'next/server'
import { getOpenAIClient, VISION_MODEL, VISION_MAX_TOKENS } from '@/lib/ai/openai-client'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { requirePermission } from '@/lib/api/with-permission'
import { validateBody } from '@/lib/api/validate'
import { aiPhotoAnalysisSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/photo-analysis' })

export async function POST(request: NextRequest) {
  const rl = checkRateLimit(request, RATE_LIMITS.ai)
  if (rl.limited) return rl.response

  // Auth + membership kontrolü (RLS bypass yerine güvenli middleware)
  const auth = await requirePermission(request, 'records')
  if (!auth.ok) return auth.response

  const parsed = await validateBody(request, aiPhotoAnalysisSchema)
  if (!parsed.ok) return parsed.response
  const { imageUrl, title, category } = parsed.data

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
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: VISION_MODEL,
      max_tokens: VISION_MAX_TOKENS,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
    })

    const responseText = completion.choices[0]?.message?.content || ''

    return NextResponse.json({ analysis: responseText })
  } catch (err) {
    log.error({ err }, 'AI fotoğraf analizi hatası')
    return NextResponse.json({ error: 'AI analizi yapılamadı' }, { status: 500 })
  }
}
