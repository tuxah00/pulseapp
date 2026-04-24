// ================================================
// lib/insights/ai-refine.ts
// Opsiyonel AI rafinman — kural tabanlı şablonu dilsel olarak yumuşatır
// ================================================
// Kullanıcı panel bölümündeki "AI ile detaylandır" butonuna bastığında
// çağrılır. Aynı (business_id + template_key + input hash) için 1 saat
// in-memory cache — 429/maliyet patlamasını engeller.
//
// Server-only. Asla client bundle'a girmemeli (lib/ai/openai-client uyarısı).

import 'server-only'
import type { InsightBlock } from './types'
import { ASSISTANT_MODEL, getOpenAIClient } from '@/lib/ai/openai-client'

const CACHE_TTL_MS = 60 * 60 * 1000 // 1 saat
const CACHE_MAX = 500 // ~yüz işletme × 5-6 kategori

interface CacheEntry {
  text: string
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function cacheKey(businessId: string, block: InsightBlock): string {
  const ctxKey = block.refineContext
    ? Object.entries(block.refineContext)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}:${roundForCache(v)}`)
        .join('|')
    : ''
  return `${businessId}:${block.template_key}:${ctxKey}`
}

function roundForCache(value: string | number | boolean): string {
  if (typeof value === 'number') {
    // Cache'in fayda sağlaması için yakın değerleri aynı anahtara toplar.
    return String(Math.round(value * 100) / 100)
  }
  return String(value)
}

function pruneCache() {
  if (cache.size <= CACHE_MAX) return
  const now = Date.now()
  for (const [k, v] of cache) {
    if (v.expiresAt <= now) cache.delete(k)
    if (cache.size <= CACHE_MAX) break
  }
  if (cache.size > CACHE_MAX) {
    // Son çare: en eski 50 kayıt düşür.
    let i = 0
    for (const k of cache.keys()) {
      cache.delete(k)
      if (++i >= 50) break
    }
  }
}

/**
 * Şablon metnini OpenAI ile rafinmandan geçirir.
 * - Metin kısa, Türkçe ve aksiyon odaklı kalır.
 * - Cache hit → aynı metin dönecek, tahmini gecikme < 10 ms.
 * - Hata durumunda orijinal `block.message` geri döner; UI hiç kırılmaz.
 */
export async function refineInsight(params: {
  businessId: string
  block: InsightBlock
  /** Opsiyonel ek kontekst (sektör/plan gibi) — kullanıcıya gösterilmez. */
  extra?: Record<string, string | number | boolean>
}): Promise<{ text: string; cached: boolean }> {
  const { businessId, block, extra } = params
  const key = cacheKey(businessId, block)
  const now = Date.now()

  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) {
    return { text: hit.text, cached: true }
  }

  try {
    const client = getOpenAIClient()
    const response = await client.chat.completions.create({
      model: ASSISTANT_MODEL,
      temperature: 0.4,
      max_tokens: 220,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: buildUserPrompt(block, extra),
        },
      ],
    })
    const text = (response.choices[0]?.message?.content || '').trim()
    if (!text) {
      return { text: block.message, cached: false }
    }
    cache.set(key, { text, expiresAt: now + CACHE_TTL_MS })
    pruneCache()
    return { text, cached: false }
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[insights] refine failed, falling back', err)
    }
    return { text: block.message, cached: false }
  }
}

const SYSTEM_PROMPT = `Sen, küçük işletmelere iş zekası özeti sunan bir danışmansın.
Kurallar:
- Sadece Türkçe yaz.
- En fazla 3 cümle kullan.
- Ton: net, destekleyici, yönlendirici. Övgü ya da azar yok.
- "Muhteşem", "inanılmaz", emoji ve ünlem yasak.
- Somut aksiyon öner (ör: "Pazartesi 10:00-12:00 dilimine kampanya aç").
- Rakamları olduğu gibi kullan; veri yoksa uydurma.`

function buildUserPrompt(
  block: InsightBlock,
  extra?: Record<string, string | number | boolean>
): string {
  const ctx = block.refineContext
    ? Object.entries(block.refineContext)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
    : '-'
  const extraStr = extra
    ? Object.entries(extra)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ')
    : '-'
  return [
    `Bölüm: ${block.category} / ${block.template_key}`,
    `Başlık: ${block.title}`,
    `Hazır metin: ${block.message}`,
    `Metrikler: ${ctx}`,
    `Ek kontekst: ${extraStr}`,
    ``,
    `Bu veriyi analiz ederek daha doğal ve kişiye özel bir metin yaz.`,
    `Başlık zaten ekranda, sadece açıklama kısmını üret.`,
  ].join('\n')
}

/** Test/debug için — mevcut cache büyüklüğünü döndürür. */
export function refineCacheSize(): number {
  return cache.size
}

/** Test için — manuel sıfırlama. */
export function resetRefineCache(): void {
  cache.clear()
}
