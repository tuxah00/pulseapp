/**
 * Webhook'tan gelen telefon numarasına göre müşteri/işletme bulma — SMS + WhatsApp
 * webhook'larında ortak.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'

export interface InboundCustomer {
  id: string
  business_id: string
  name: string
}

export async function resolveInboundCustomer(
  admin: SupabaseClient,
  from: string,
): Promise<InboundCustomer | null> {
  const normalized = normalizePhone(from)
  if (!normalized) return null

  const { data } = await admin
    .from('customers')
    .select('id, business_id, name')
    .or(phoneOrFilter(normalized))
    .eq('is_active', true)
    .limit(1)

  return data?.[0] ?? null
}
