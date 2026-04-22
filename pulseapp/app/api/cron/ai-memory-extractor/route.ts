import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { getOpenAIClient, ASSISTANT_MODEL } from '@/lib/ai/openai-client'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/ai-memory-extractor' })

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Nightly: Aktif sohbetlerin (son 7 gün) özetini çıkar.
 *
 * İki görev:
 * 1) Uzun sohbetler için summary güncelle (ai_conversations.summary)
 * 2) (Opsiyonel ilerideki adım) Kullanıcı davranışlarından pattern çıkarıp ai_business_memory'ye yaz
 *    — şu an sadece 1. görev. 2. görev Faz 4'te detaylandırılacak.
 *
 * Hedef conversation: son 24 saatte güncellenen VE (summary boş VEYA 20+ yeni mesaj var) olanlar.
 */

const SUMMARY_THRESHOLD = 20 // Yeni mesaj sayısı eşiği
const BATCH_SIZE = 20 // Tek run'da max kaç conversation işlensin

interface ConversationToSummarize {
  id: string
  business_id: string
  current_summary: string | null
  message_count_at_summary: number
  total_messages: number
}

async function findConversationsNeedingSummary(
  admin: ReturnType<typeof createAdminClient>,
): Promise<ConversationToSummarize[]> {
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()

  // Son 24 saatte güncellenen sohbetler
  const { data: convs } = await admin
    .from('ai_conversations')
    .select('id, business_id, summary, summary_updated_at, message_count_at_summary, updated_at')
    .gte('updated_at', since)
    .limit(100)

  if (!convs || convs.length === 0) return []

  // Her biri için mesaj sayısını say
  const results: ConversationToSummarize[] = []
  for (const c of convs) {
    const { count } = await admin
      .from('ai_messages')
      .select('id', { count: 'exact', head: true })
      .eq('conversation_id', c.id)

    const total = count ?? 0
    const summarized = (c as any).message_count_at_summary ?? 0
    const delta = total - summarized

    // Özet yoksa ve 10+ mesaj var → özet gerekir
    // Özet varsa ve 20+ yeni mesaj var → güncelleme gerekir
    if ((!(c as any).summary && total >= 10) || delta >= SUMMARY_THRESHOLD) {
      results.push({
        id: c.id,
        business_id: (c as any).business_id,
        current_summary: (c as any).summary,
        message_count_at_summary: summarized,
        total_messages: total,
      })
    }
  }

  return results.slice(0, BATCH_SIZE)
}

async function summarizeConversation(
  admin: ReturnType<typeof createAdminClient>,
  conv: ConversationToSummarize,
): Promise<boolean> {
  // Son 50 mesajı çek (summary ile birleştirerek bütünlüğü koru)
  const { data: msgs } = await admin
    .from('ai_messages')
    .select('role, content, created_at')
    .eq('conversation_id', conv.id)
    .order('created_at', { ascending: false })
    .limit(50)

  if (!msgs || msgs.length === 0) return false

  const reversed = [...msgs].reverse()
  const conversationText = reversed
    .filter(m => m.content && m.role !== 'tool')
    .map(m => {
      const who = m.role === 'user' ? 'Kullanıcı' : 'Asistan'
      const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content)
      return `${who}: ${content.slice(0, 500)}`
    })
    .join('\n')

  if (conversationText.length < 200) return false

  const previousSummary = conv.current_summary
    ? `\n\n[Önceki özet]: ${conv.current_summary}`
    : ''

  const prompt = `Aşağıdaki Türkçe sohbet geçmişini özetle. Odak: konuşulan müşteriler, verilen kararlar, alınan eylemler, kullanıcı tercihleri. Madde listesi değil, 3-5 cümlelik yoğun özet yaz. Önceki özet varsa onu yeni bilgiyle birleştir; tekrara düşme.${previousSummary}

[Sohbet]
${conversationText}

[Özet]`

  try {
    const openai = getOpenAIClient()
    const completion = await openai.chat.completions.create({
      model: ASSISTANT_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    })

    const summary = completion.choices[0]?.message?.content?.trim() ?? ''
    if (!summary || summary.length < 30) return false

    const { error } = await admin
      .from('ai_conversations')
      .update({
        summary,
        summary_updated_at: new Date().toISOString(),
        message_count_at_summary: conv.total_messages,
      })
      .eq('id', conv.id)

    if (error) {
      log.error({ err: error, convId: conv.id }, '[memory-extractor] update error')
      return false
    }
    return true
  } catch (err) {
    log.error({ err, convId: conv.id }, '[memory-extractor] openai error')
    return false
  }
}

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  if (!process.env.OPENAI_API_KEY) {
    log.error({}, 'OPENAI_API_KEY yok, memory-extractor atlanıyor')
    return NextResponse.json({ ok: false, reason: 'missing_openai_key' })
  }

  const admin = createAdminClient()

  try {
    const candidates = await findConversationsNeedingSummary(admin)
    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'no candidates' })
    }

    let summarized = 0
    let failed = 0
    for (const conv of candidates) {
      const ok = await summarizeConversation(admin, conv)
      if (ok) summarized++
      else failed++
    }

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      summarized,
      failed,
    })
  } catch (err: any) {
    log.error({ err }, '[memory-extractor] fatal')
    return NextResponse.json({ ok: false, error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
