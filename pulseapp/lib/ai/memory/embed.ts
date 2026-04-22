import type { SupabaseClient } from '@supabase/supabase-js'
import { getOpenAIClient, EMBEDDING_MODEL } from '@/lib/ai/openai-client'
import type { EmbeddingContentType, SemanticSearchResult } from './types'

type SupabaseAdmin = SupabaseClient<any, any, any>

/**
 * Tek bir metni vektöre çevir.
 * Uzun metinleri 8192 token sınırının içinde tutmak için 30000 karakterle sınırla.
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!text || text.trim().length < 3) return null

  const trimmed = text.trim().slice(0, 30000)
  try {
    const openai = getOpenAIClient()
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: trimmed,
    })
    return res.data[0]?.embedding ?? null
  } catch (err) {
    console.error('generateEmbedding error:', err)
    return null
  }
}

/**
 * Birden çok metni tek API çağrısıyla embed et (batch).
 */
export async function generateEmbeddingsBatch(
  texts: string[]
): Promise<Array<number[] | null>> {
  if (!texts || texts.length === 0) return []

  const cleaned = texts.map(t => (t || '').trim().slice(0, 30000))
  const nonEmpty = cleaned.filter(t => t.length >= 3)
  if (nonEmpty.length === 0) return texts.map(() => null)

  try {
    const openai = getOpenAIClient()
    const res = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: nonEmpty,
    })
    // Sonuçları orijinal sıraya geri yerleştir
    const results: Array<number[] | null> = []
    let resIdx = 0
    for (const text of cleaned) {
      if (text.length >= 3) {
        results.push(res.data[resIdx]?.embedding ?? null)
        resIdx++
      } else {
        results.push(null)
      }
    }
    return results
  } catch (err) {
    console.error('generateEmbeddingsBatch error:', err)
    return texts.map(() => null)
  }
}

/**
 * Embedding'i ai_embeddings tablosuna upsert et.
 */
export async function upsertEmbedding(
  admin: SupabaseAdmin,
  input: {
    businessId: string
    contentType: EmbeddingContentType
    contentId: string
    customerId?: string | null
    text: string
    metadata?: Record<string, any>
  }
): Promise<boolean> {
  const embedding = await generateEmbedding(input.text)
  if (!embedding) return false

  const { error } = await admin.from('ai_embeddings').upsert(
    {
      business_id: input.businessId,
      content_type: input.contentType,
      content_id: input.contentId,
      customer_id: input.customerId ?? null,
      text: input.text,
      embedding: embedding as any,
      metadata: input.metadata ?? {},
    },
    { onConflict: 'business_id,content_type,content_id' }
  )
  if (error) {
    console.error('upsertEmbedding error:', error.message)
    return false
  }
  return true
}

/**
 * Anlamsal arama: metin sorgusuyla benzer içerikleri getir.
 * pgvector search_embeddings() fonksiyonunu çağırır.
 */
export async function semanticSearch(
  admin: SupabaseAdmin,
  businessId: string,
  query: string,
  options?: {
    limit?: number
    contentType?: EmbeddingContentType
    customerId?: string
    minSimilarity?: number
  }
): Promise<SemanticSearchResult[]> {
  const queryEmbedding = await generateEmbedding(query)
  if (!queryEmbedding) return []

  const { data, error } = await admin.rpc('search_embeddings', {
    p_business_id: businessId,
    p_query_embedding: queryEmbedding as any,
    p_match_count: options?.limit ?? 10,
    p_content_type: options?.contentType ?? null,
    p_customer_id: options?.customerId ?? null,
    p_min_similarity: options?.minSimilarity ?? 0.5,
  })
  if (error) {
    console.error('semanticSearch error:', error.message)
    return []
  }
  return (data as SemanticSearchResult[]) ?? []
}

/**
 * KVKK: Belirli müşterinin tüm embedding'lerini sil.
 */
export async function deleteCustomerEmbeddings(
  admin: SupabaseAdmin,
  businessId: string,
  customerId: string
): Promise<number> {
  const { data, error } = await admin
    .from('ai_embeddings')
    .delete()
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .select('id')
  if (error) {
    console.error('deleteCustomerEmbeddings error:', error.message)
    return 0
  }
  return data?.length ?? 0
}
