import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client'
import { getPhotoAnalysisPrompt } from '@/lib/ai/photo-prompts'
import type { SectorType } from '@/types'

// POST: Tek fotoğraf analizi
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await req.json()
  const { photoUrl, analysisType = 'single', customerId } = body

  if (!photoUrl) {
    return NextResponse.json({ error: 'photoUrl zorunlu' }, { status: 400 })
  }

  const supabase = createServerSupabaseClient()

  // İşletmenin sektörünü al
  const { data: business } = await supabase
    .from('businesses')
    .select('sector')
    .eq('id', businessId)
    .single()

  const sector = (business?.sector || null) as SectorType | null
  const systemPrompt = getPhotoAnalysisPrompt(sector, analysisType)

  try {
    const anthropic = getAnthropicClient()
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'url',
                url: photoUrl,
              },
            },
            {
              type: 'text',
              text: systemPrompt,
            },
          ],
        },
      ],
    })

    const analysis = message.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('\n')

    // Analiz sonucunu müşteri kaydına ekleyebilmek için customer_id döndür
    return NextResponse.json({
      analysis,
      sector,
      analysisType,
      customerId: customerId || null,
    })
  } catch (err: unknown) {
    console.error('AI fotoğraf analizi hatası:', err)
    const message = err instanceof Error ? err.message : 'Analiz yapılamadı'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
