import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessMemoryRow, MemoryUpsertInput, MemoryScope } from './types'

type SupabaseAdmin = SupabaseClient<any, any, any>

/**
 * Hafıza kaydı ekle veya güncelle (atomik upsert).
 *
 * T1.7 — find + insert/update pattern'i race'e açıktı. Tek SQL INSERT...ON CONFLICT
 * çağrısına dönüştürüldü; `upsert_ai_memory` RPC'si confidence max hesaplamasını
 * SQL-side yapar ve atomik upsert sağlar (migration 069).
 */
export async function upsertMemory(
  admin: SupabaseAdmin,
  input: MemoryUpsertInput
): Promise<BusinessMemoryRow | null> {
  const { data, error } = await admin.rpc('upsert_ai_memory', {
    p_business_id: input.businessId,
    p_scope: input.scope,
    p_scope_id: input.scopeId ?? null,
    p_key: input.key,
    p_value: input.value,
    p_confidence: input.confidence ?? 0.8,
    p_source: input.source ?? 'explicit_user',
    p_created_by_staff_id: input.createdByStaffId ?? null,
    p_expires_at: input.expiresAt ?? null,
  })

  if (error) {
    console.error('upsertMemory error:', error.message)
    return null
  }
  return (data as BusinessMemoryRow | null) ?? null
}

/**
 * Hafıza kaydını sil.
 */
export async function deleteMemory(
  admin: SupabaseAdmin,
  businessId: string,
  scope: MemoryScope,
  scopeId: string | null,
  key: string
): Promise<boolean> {
  let q = admin
    .from('ai_business_memory')
    .delete()
    .eq('business_id', businessId)
    .eq('scope', scope)
    .eq('key', key)

  if (scopeId) {
    q = q.eq('scope_id', scopeId)
  } else {
    q = q.is('scope_id', null)
  }

  const { error } = await q
  if (error) {
    console.error('deleteMemory error:', error.message)
    return false
  }
  return true
}

/**
 * Belirli bir müşterinin TÜM hafıza kayıtlarını sil (KVKK veri silme için).
 */
export async function deleteCustomerMemory(
  admin: SupabaseAdmin,
  businessId: string,
  customerId: string
): Promise<number> {
  const { data, error } = await admin
    .from('ai_business_memory')
    .delete()
    .eq('business_id', businessId)
    .eq('scope', 'customer')
    .eq('scope_id', customerId)
    .select('id')
  if (error) {
    console.error('deleteCustomerMemory error:', error.message)
    return 0
  }
  return data?.length ?? 0
}

async function findMemory(
  admin: SupabaseAdmin,
  businessId: string,
  scope: MemoryScope,
  scopeId: string | null,
  key: string
): Promise<BusinessMemoryRow | null> {
  let q = admin
    .from('ai_business_memory')
    .select('*')
    .eq('business_id', businessId)
    .eq('scope', scope)
    .eq('key', key)

  if (scopeId) {
    q = q.eq('scope_id', scopeId)
  } else {
    q = q.is('scope_id', null)
  }

  const { data } = await q.maybeSingle()
  return data
}
