import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client'
import { getReplySystemPrompt } from '@/lib/ai/prompts'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import type { AiClassification, WorkingHours, DayHours } from '@/types'

const DAY_LABELS: Record<string, string> = {
  mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz',
}

function formatWorkingHoursText(hours: WorkingHours | null): string {
  if (!hours) return 'Belirtilmemiş'
  const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
  return days
    .map(d => {
      const h = hours[d]
      return h ? `${DAY_LABELS[d]}: ${h.open}-${h.close}` : `${DAY_LABELS[d]}: Kapalı`
    })
    .join(', ')
}

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
    const { message, businessId, classification, customerName } = body

    if (!message || !businessId) {
      return NextResponse.json({ error: 'message ve businessId gerekli' }, { status: 400 })
    }

    const [businessRes, servicesRes] = await Promise.all([
      supabase
        .from('businesses')
        .select('name, sector, working_hours, phone')
        .eq('id', businessId)
        .single(),
      supabase
        .from('services')
        .select('name, duration_minutes, price')
        .eq('business_id', businessId)
        .eq('is_active', true)
        .order('sort_order'),
    ])

    if (!businessRes.data) {
      return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
    }

    const business = businessRes.data
    const services = (servicesRes.data || []).map(
      s => `${s.name} (${s.duration_minutes} dk${s.price ? `, ${s.price} TL` : ''})`
    )
    const workingHoursText = formatWorkingHoursText(business.working_hours)

    const client = getAnthropicClient()
    const systemPrompt = getReplySystemPrompt(
      business.sector, business.name, services, workingHoursText
    )

    const userContent = customerName
      ? `Müşteri adı: ${customerName}\nMesaj sınıfı: ${classification || 'bilinmiyor'}\n\nMüşteri mesajı: "${message}"`
      : `Mesaj sınıfı: ${classification || 'bilinmiyor'}\n\nMüşteri mesajı: "${message}"`

    const response = await client.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const reply = response.content[0].type === 'text' ? response.content[0].text : ''

    return NextResponse.json({
      reply: reply.trim(),
      classification: classification || null,
    })
  } catch (error) {
    console.error('AI reply hatası:', error)
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      { error: 'AI yanıt oluşturma hatası', details: message },
      { status: 500 }
    )
  }
}
