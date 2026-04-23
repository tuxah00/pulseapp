import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessMemoryRow, MemoryUpsertInput, MemoryScope } from './types'

type SupabaseAdmin = SupabaseClient<any, any, any>

/**
 * Hafıza kaydı ekle veya güncelle (upsert).
 * Aynı (business_id, scope, scope_id, key) mevcutsa değer ve last_reinforced_at güncellenir.
 */
export async function upsertMemory(
  admin: SupabaseAdmin,
  input: MemoryUpsertInput
): Promise<BusinessMemoryRow | null> {
  // Önce mevcut kaydı bul
  const existing = await findMemory(
    admin,
    input.businessId,
    input.scope,
    input.scopeId ?? null,
    input.key
  )

  const payload: any = {
    business_id: input.businessId,
    scope: input.scope,
    scope_id: input.scopeId ?? null,
    key: input.key,
    value: input.value,
    confidence: input.confidence ?? 0.8,
    source: input.source ?? 'explicit_user',
    created_by_staff_id: input.createdByStaffId ?? null,
    last_reinforced_at: new Date().toISOString(),
    expires_at: input.expiresAt ?? null,
  }

  if (existing) {
    // Güncelle — confidence öncekinin max'ı ile yenininki arasında en yüksek
    const newConfidence = Math.max(existing.confidence, payload.confidence)
    const { data, error } = await admin
      .from('ai_business_memory')
      .update({ ...payload, confidence: newConfidence })
      .eq('id', existing.id)
      .select()
      .maybeSingle()
    if (error) {
      console.error('upsertMemory update error:', error.message)
      return null
    }
    return data
  } else {
    const { data, error } = await admin
      .from('ai_business_memory')
      .insert(payload)
      .select()
      .maybeSingle()
    if (error) {
      console.error('upsertMemory insert error:', error.message)
      return null
    }
    return data
  }
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
