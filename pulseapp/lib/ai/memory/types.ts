// AI Hafıza sistem tipleri

export type MemoryScope = 'business' | 'customer' | 'staff'
export type MemorySource = 'explicit_user' | 'inferred_behavior' | 'cron_analysis'

export interface BusinessMemoryRow {
  id: string
  business_id: string
  scope: MemoryScope
  scope_id: string | null
  key: string
  value: Record<string, any>
  confidence: number
  source: MemorySource
  created_by_staff_id: string | null
  last_reinforced_at: string
  expires_at: string | null
  created_at: string
  updated_at: string
}

export interface MemoryUpsertInput {
  businessId: string
  scope: MemoryScope
  scopeId?: string | null
  key: string
  value: Record<string, any>
  confidence?: number
  source?: MemorySource
  createdByStaffId?: string | null
  expiresAt?: string | null
}

export type EmbeddingContentType =
  | 'ai_message'
  | 'customer_note'
  | 'business_record'
  | 'protocol_note'
  | 'protocol_session_note'

export interface EmbeddingRow {
  id: string
  business_id: string
  content_type: EmbeddingContentType
  content_id: string
  customer_id: string | null
  text: string
  metadata: Record<string, any>
  created_at: string
}

export interface SemanticSearchResult {
  id: string
  content_type: EmbeddingContentType
  content_id: string
  customer_id: string | null
  text: string
  metadata: Record<string, any>
  similarity: number
  created_at: string
}
