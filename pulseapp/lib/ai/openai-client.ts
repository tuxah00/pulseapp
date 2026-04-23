import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getOpenAIClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    })
  }
  return _client
}

// Tek motor: GPT-4o Mini — tüm AI endpoint'leri bu modeli kullanır.
// Prompt caching: sistem promptlarının başlangıç kısmı stabil tutulduğunda
// OpenAI otomatik caching uygular (>1024 token istemlerde %50 indirim).
export const ASSISTANT_MODEL = 'gpt-4o-mini'
export const ASSISTANT_MAX_TOKENS = 2048

// Hafif sınıflandırma ve yanıt üretimi için aynı model (bütçe farkı yok)
export const CLASSIFY_MODEL = 'gpt-4o-mini'
export const REPLY_MODEL = 'gpt-4o-mini'
export const DEFAULT_MAX_TOKENS = 1024

// Vision görevleri (foto analizi, before/after karşılaştırma)
export const VISION_MODEL = 'gpt-4o-mini'
export const VISION_MAX_TOKENS = 1500

// Embedding modeli (RAG — Faz 2'de aktifleşecek)
export const EMBEDDING_MODEL = 'text-embedding-3-small'
