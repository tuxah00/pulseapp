import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'
import { getAnthropicClient, AI_MODEL } from '@/lib/ai/client'

export interface CampaignSuggestion {
  segment: string
  segmentLabel: string
  customerCount: number
  campaignType: 'winback' | 'upsell' | 'loyalty' | 'birthday' | 'seasonal'
  subject: string
  message: string
  bestTime: string
}

// POST: Müşteri segmentlerine göre kampanya önerisi
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const admin = createAdminClient()
  const now = new Date()

  // Segment istatistiklerini topla
  const [bizResult, segmentResult, birthdayResult] = await Promise.all([
    admin.from('businesses').select('name, sector').eq('id', businessId).single(),
    admin.from('customers')
      .select('segment, total_visits, last_visit_at')
      .eq('business_id', businessId)
      .eq('is_active', true),
    admin.from('customers')
      .select('id, name')
      .eq('business_id', businessId)
      .eq('is_active', true)
      .not('birthday', 'is', null)
      .gte('birthday', `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`)
      .lte('birthday', new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
  ])

  const business = bizResult.data
  const customers = segmentResult.data || []

  // Segment sayıları
  const segmentCounts: Record<string, number> = {}
  for (const c of customers) {
    segmentCounts[c.segment || 'new'] = (segmentCounts[c.segment || 'new'] || 0) + 1
  }

  // Risk (60+ gün gelmeyen)
  const sixtyDaysAgo = new Date(now)
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60)
  const riskCount = customers.filter(c =>
    c.last_visit_at && new Date(c.last_visit_at) < sixtyDaysAgo && c.total_visits > 0
  ).length

  // VIP sayısı
  const vipCount = segmentCounts['vip'] || 0

  // Yaklaşan doğum günü
  const upcomingBirthdays = birthdayResult.data?.length || 0

  // Türk ayı/mevsim tespiti
  const month = now.getMonth() + 1
  const seasonHints = month >= 3 && month <= 5 ? 'İlkbahar (yeni bakım sezonu)'
    : month >= 6 && month <= 8 ? 'Yaz (tatil öncesi bakım)'
    : month >= 9 && month <= 11 ? 'Sonbahar (sezon başlangıcı)'
    : 'Kış (yıl sonu promosyonları)'

  const prompt = `Sen bir Türk işletmesi için pazarlama uzmanısın. Aşağıdaki verilere göre en etkili kampanya önerileri sun.

İşletme: ${business?.name} (${business?.sector})
Tarih: ${now.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}
Mevsim: ${seasonHints}

Müşteri Verileri:
- Yeni müşteriler: ${segmentCounts['new'] || 0}
- Düzenli müşteriler: ${segmentCounts['regular'] || 0}
- VIP müşteriler: ${vipCount}
- Risk müşteriler (60+ gün gelmeyen): ${riskCount}
- Kayıp müşteriler: ${segmentCounts['lost'] || 0}
- Yaklaşan doğum günleri (14 gün): ${upcomingBirthdays}

Her öneri için şunları belirt:
- Hedef segment
- Kampanya tipi (winback/upsell/loyalty/birthday/seasonal)
- Mesaj başlığı (SMS/WhatsApp için kısa)
- Mesaj içeriği (140 karakter altında, Türkçe)
- En iyi gönderim zamanı

Yanıtı SADECE JSON formatında ver:
{
  "suggestions": [
    {
      "segment": "risk",
      "segmentLabel": "Risk Müşteriler",
      "customerCount": ${riskCount},
      "campaignType": "winback",
      "subject": "Özledik!",
      "message": "Sizi özledik! Bu ay %20 indirimle randevu alın.",
      "bestTime": "Salı-Perşembe, 10:00-12:00"
    }
  ]
}`

  try {
    const anthropic = getAnthropicClient()
    const message = await anthropic.messages.create({
      model: AI_MODEL,
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    })

    const content = message.content[0]
    if (content.type !== 'text') {
      return NextResponse.json({ error: 'AI yanıtı alınamadı' }, { status: 500 })
    }

    let suggestions: CampaignSuggestion[] = []
    const jsonMatch = content.text.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      suggestions = parsed.suggestions || []
    }

    return NextResponse.json({
      suggestions,
      stats: { segmentCounts, riskCount, upcomingBirthdays, totalCustomers: customers.length },
    })
  } catch (err: unknown) {
    console.error('AI kampanya önerisi hatası:', err)
    const message = err instanceof Error ? err.message : 'Kampanya önerisi alınamadı'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
