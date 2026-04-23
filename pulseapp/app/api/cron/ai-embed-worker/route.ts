import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { generateEmbeddingsBatch } from '@/lib/ai/memory/embed'
import { createLogger } from '@/lib/utils/logger'
import type { EmbeddingContentType } from '@/lib/ai/memory/types'

const log = createLogger({ route: 'api/cron/ai-embed-worker' })

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Nightly: Son 6 ay içindeki yeni içerikleri embed et ve ai_embeddings tablosuna yaz.
 * Kapsam: ai_messages, customers.notes, business_records, treatment_protocols.notes, protocol_sessions.notes
 *
 * Mantık: Her tablodan embed edilmemiş (ai_embeddings'de content_id = id olmayan) kayıtları çek,
 * OpenAI batch embedding ile vektöre çevir, upsert et.
 *
 * Batch başına max 50 kayıt (OpenAI API limiti: tek istekte 2048 input, ama biz 50'yi seçiyoruz).
 */

const BATCH_SIZE = 50
const LOOKBACK_DAYS = 180 // 6 ay

interface PendingItem {
  content_type: EmbeddingContentType
  content_id: string
  business_id: string
  customer_id: string | null
  text: string
  metadata: Record<string, any>
}

async function collectPendingItems(
  admin: ReturnType<typeof createAdminClient>,
  sinceIso: string,
): Promise<PendingItem[]> {
  const items: PendingItem[] = []

  // 1. ai_messages — sadece assistant veya user rolü, min 200 karakter
  const { data: aiMsgs } = await admin
    .from('ai_messages')
    .select('id, content, conversation_id, role, created_at, ai_conversations!inner(business_id)')
    .in('role', ['user', 'assistant'])
    .gte('created_at', sinceIso)
    .not('content', 'is', null)
    .limit(BATCH_SIZE)

  for (const m of aiMsgs ?? []) {
    const content = (m as any).content as string
    const businessId = (m as any).ai_conversations?.business_id
    if (!content || content.length < 200 || !businessId) continue
    items.push({
      content_type: 'ai_message',
      content_id: m.id,
      business_id: businessId,
      customer_id: null,
      text: content,
      metadata: { role: m.role, conversation_id: m.conversation_id, created_at: m.created_at },
    })
  }

  // 2. customer_notes — customers.notes alanı dolu olanlar
  const { data: customerNotes } = await admin
    .from('customers')
    .select('id, business_id, name, notes, updated_at')
    .not('notes', 'is', null)
    .gte('updated_at', sinceIso)
    .limit(BATCH_SIZE)

  for (const c of customerNotes ?? []) {
    const notes = (c as any).notes as string
    if (!notes || notes.length < 50) continue
    items.push({
      content_type: 'customer_note',
      content_id: c.id,
      business_id: c.business_id,
      customer_id: c.id,
      text: notes,
      metadata: { customer_name: (c as any).name, updated_at: (c as any).updated_at },
    })
  }

  // 3. business_records — hasta dosyası notları
  const { data: records } = await admin
    .from('business_records')
    .select('id, business_id, customer_id, type, data, updated_at')
    .gte('updated_at', sinceIso)
    .limit(BATCH_SIZE)

  for (const r of records ?? []) {
    const data = (r as any).data as Record<string, any> | null
    if (!data) continue
    // Düz metin alanlarını birleştir
    const parts: string[] = []
    for (const [k, v] of Object.entries(data)) {
      if (typeof v === 'string' && v.length > 10) parts.push(`${k}: ${v}`)
    }
    const text = parts.join('\n')
    if (text.length < 50) continue
    items.push({
      content_type: 'business_record',
      content_id: r.id,
      business_id: r.business_id,
      customer_id: r.customer_id,
      text,
      metadata: { type: (r as any).type, updated_at: (r as any).updated_at },
    })
  }

  // 4. treatment_protocols.notes
  const { data: protocols } = await admin
    .from('treatment_protocols')
    .select('id, business_id, customer_id, name, notes, updated_at')
    .not('notes', 'is', null)
    .gte('updated_at', sinceIso)
    .limit(BATCH_SIZE)

  for (const p of protocols ?? []) {
    const notes = (p as any).notes as string
    if (!notes || notes.length < 50) continue
    items.push({
      content_type: 'protocol_note',
      content_id: p.id,
      business_id: p.business_id,
      customer_id: p.customer_id,
      text: `${(p as any).name}\n${notes}`,
      metadata: { protocol_name: (p as any).name, updated_at: (p as any).updated_at },
    })
  }

  // 5. protocol_sessions.notes
  const { data: sessions } = await admin
    .from('protocol_sessions')
    .select('id, notes, updated_at, treatment_protocols!inner(business_id, customer_id, name)')
    .not('notes', 'is', null)
    .gte('updated_at', sinceIso)
    .limit(BATCH_SIZE)

  for (const s of sessions ?? []) {
    const notes = (s as any).notes as string
    const parent = (s as any).treatment_protocols
    if (!notes || notes.length < 50 || !parent?.business_id) continue
    items.push({
      content_type: 'protocol_session_note',
      content_id: s.id,
      business_id: parent.business_id,
      customer_id: parent.customer_id,
      text: notes,
      metadata: { protocol_name: parent.name, updated_at: (s as any).updated_at },
    })
  }

  return items
}

async function filterAlreadyEmbedded(
  admin: ReturnType<typeof createAdminClient>,
  items: PendingItem[],
): Promise<PendingItem[]> {
  if (items.length === 0) return []

  // Mevcut embedding'leri sorgula (aynı content_type + content_id var mı)
  const keys = items.map(i => ({ content_type: i.content_type, content_id: i.content_id }))
  const byType: Record<string, string[]> = {}
  for (const k of keys) {
    byType[k.content_type] ??= []
    byType[k.content_type].push(k.content_id)
  }

  const existing = new Set<string>()
  for (const [type, ids] of Object.entries(byType)) {
    const { data } = await admin
      .from('ai_embeddings')
      .select('content_type, content_id')
      .eq('content_type', type)
      .in('content_id', ids)
    for (const e of data ?? []) {
      existing.add(`${e.content_type}::${e.content_id}`)
    }
  }

  return items.filter(i => !existing.has(`${i.content_type}::${i.content_id}`))
}

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  if (!process.env.OPENAI_API_KEY) {
    log.error({}, 'OPENAI_API_KEY yok, embed-worker atlanıyor')
    return NextResponse.json({ ok: false, reason: 'missing_openai_key' })
  }

  const admin = createAdminClient()
  const sinceIso = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString()

  try {
    const candidates = await collectPendingItems(admin, sinceIso)
    if (candidates.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'no candidates' })
    }

    const pending = await filterAlreadyEmbedded(admin, candidates)
    if (pending.length === 0) {
      return NextResponse.json({ ok: true, processed: 0, note: 'all already embedded' })
    }

    // Batch embedding
    const texts = pending.map(p => p.text)
    const embeddings = await generateEmbeddingsBatch(texts)

    // Upsert
    let inserted = 0
    const rowsToInsert = pending.map((p, idx) => {
      const vec = embeddings[idx]
      if (!vec) return null
      return {
        business_id: p.business_id,
        content_type: p.content_type,
        content_id: p.content_id,
        customer_id: p.customer_id,
        text: p.text.slice(0, 8000), // Güvenlik için kısalt
        embedding: vec as any,
        metadata: p.metadata,
      }
    }).filter(Boolean) as any[]

    if (rowsToInsert.length > 0) {
      const { error } = await admin.from('ai_embeddings').upsert(
        rowsToInsert,
        { onConflict: 'business_id,content_type,content_id' }
      )
      if (error) {
        log.error({ err: error }, '[embed-worker] upsert error')
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
      }
      inserted = rowsToInsert.length
    }

    return NextResponse.json({
      ok: true,
      candidates: candidates.length,
      pending: pending.length,
      inserted,
    })
  } catch (err: any) {
    log.error({ err }, '[embed-worker] fatal')
    return NextResponse.json({ ok: false, error: err?.message ?? 'unknown' }, { status: 500 })
  }
}
