import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessMemoryRow, MemoryScope } from './types'

type SupabaseAdmin = SupabaseClient<any, any, any>

/**
 * Belirli bir business için hafıza kayıtlarını okur.
 * AI asistan sohbeti başlamadan önce çağrılır; system prompt'a enjekte edilir.
 */
export async function readBusinessMemory(
  admin: SupabaseAdmin,
  businessId: string,
  options?: {
    customerId?: string | null
    staffId?: string | null
    minConfidence?: number
    includeExpired?: boolean
  }
): Promise<BusinessMemoryRow[]> {
  const minConfidence = options?.minConfidence ?? 0.5
  const now = new Date().toISOString()

  let q = admin
    .from('ai_business_memory')
    .select('*')
    .eq('business_id', businessId)
    .gte('confidence', minConfidence)

  if (!options?.includeExpired) {
    q = q.or(`expires_at.is.null,expires_at.gt.${now}`)
  }

  // Business-level her zaman çekilir; ayrıca seçilen customer/staff varsa onlar da
  const scopeFilters: string[] = [`scope.eq.business`]
  if (options?.customerId) {
    scopeFilters.push(`and(scope.eq.customer,scope_id.eq.${options.customerId})`)
  }
  if (options?.staffId) {
    scopeFilters.push(`and(scope.eq.staff,scope_id.eq.${options.staffId})`)
  }

  // Eğer müşteri ya da personel ID verilmişse OR ile birleştir
  if (scopeFilters.length > 1) {
    q = q.or(scopeFilters.join(','))
  } else {
    q = q.eq('scope', 'business')
  }

  q = q.order('scope', { ascending: true }).order('last_reinforced_at', { ascending: false })

  const { data, error } = await q
  if (error) {
    console.error('readBusinessMemory error:', error.message)
    return []
  }
  return data ?? []
}

/**
 * Tek bir hafıza satırını oku (scope + scopeId + key ile).
 */
export async function readMemoryByKey(
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

  const { data, error } = await q.maybeSingle()
  if (error) {
    console.error('readMemoryByKey error:', error.message)
    return null
  }
  return data
}

/**
 * Hafıza listesini insanın anlayabileceği yapılandırılmış metne çevirir.
 * System prompt'a gömülecek biçimde.
 */
export function formatMemoryForPrompt(rows: BusinessMemoryRow[]): string {
  if (!rows || rows.length === 0) return ''

  const business = rows.filter(r => r.scope === 'business')
  const customer = rows.filter(r => r.scope === 'customer')
  const staff = rows.filter(r => r.scope === 'staff')

  const sections: string[] = []
  sections.push('## Hatırladıklarım (uzun vadeli hafıza)')

  if (business.length > 0) {
    sections.push('\n### İşletme tercihleri')
    for (const row of business) {
      sections.push(`- **${row.key}**: ${renderValue(row.value)}`)
    }
  }

  if (customer.length > 0) {
    sections.push('\n### Bu müşteri hakkında bildiklerim')
    for (const row of customer) {
      sections.push(`- **${row.key}**: ${renderValue(row.value)}`)
    }
  }

  if (staff.length > 0) {
    sections.push('\n### Personel tercihleri')
    for (const row of staff) {
      sections.push(`- **${row.key}**: ${renderValue(row.value)}`)
    }
  }

  sections.push(
    '\n> Bu bilgileri sohbette aktif olarak kullan. Kullanıcı çelişkili bir şey söylerse, hafızayı güncellemek için `remember_preference` aracını çağır.'
  )

  return sections.join('\n')
}

function renderValue(value: Record<string, any>): string {
  if (!value) return '—'
  if (typeof value === 'string') return value
  // Yaygın kalıplar
  if ('text' in value && typeof value.text === 'string') return value.text
  if ('note' in value && typeof value.note === 'string') return value.note
  // Tek anahtarlı object
  const keys = Object.keys(value)
  if (keys.length === 1) {
    const v = value[keys[0]]
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      return `${keys[0]}: ${v}`
    }
  }
  // Genel JSON fallback (kompakt)
  try {
    return JSON.stringify(value)
  } catch {
    return '[kompleks değer]'
  }
}
