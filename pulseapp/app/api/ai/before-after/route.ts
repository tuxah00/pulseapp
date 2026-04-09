import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { requirePermission } from '@/lib/api/with-permission'
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client'
import { getPhotoAnalysisPrompt } from '@/lib/ai/photo-prompts'
import type { SectorType } from '@/types'

// POST: Öncesi/Sonrası karşılaştırma
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'records')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await req.json()
  const { beforeUrl, afterUrl, customerId, protocolId } = body

  if (!beforeUrl || !afterUrl) {
    return NextResponse.json({ error: 'beforeUrl ve afterUrl zorunlu' }, { status: 400 })
  }

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
    const anthropic = getAnthropicClient()
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Birinci fotoğraf (TEDAVİ ÖNCESİ):',
            },
            {
              type: 'image',
              source: {
                type: 'url',
                url: beforeUrl,
              },
            },
            {
              type: 'text',
              text: 'İkinci fotoğraf (TEDAVİ SONRASI):',
            },
            {
              type: 'image',
              source: {
                type: 'url',
                url: afterUrl,
              },
            },
            {
              type: 'text',
              text: systemPrompt + protocolContext,
            },
          ],
        },
      ],
    })

    const analysis = message.content
      .filter(b => b.type === 'text')
      .map(b => b.type === 'text' ? b.text : '')
      .join('\n')

    return NextResponse.json({
      analysis,
      sector,
      customerId: customerId || null,
      protocolId: protocolId || null,
    })
  } catch (err: unknown) {
    console.error('AI before-after analizi hatası:', err)
    const message = err instanceof Error ? err.message : 'Analiz yapılamadı'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
