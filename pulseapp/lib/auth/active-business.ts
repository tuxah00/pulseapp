import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Aktif işletme yönetimi — cookie tabanlı.
 *
 * Kullanıcı birden fazla işletmede personel olabilir. Bu modül,
 * hangi işletmeyi "aktif" kabul edeceğimizi belirler:
 *  1. `active_business_id` cookie'si varsa + kullanıcı o işletmede aktif personel ise → onu kullan
 *  2. Cookie yoksa VE kullanıcı tek bir işletmede personel ise → otomatik o işletmeyi seç
 *  3. Cookie yoksa VE kullanıcı birden fazla işletmede ise → picker'a yönlendir
 *  4. Hiç personel kaydı yoksa → null (onboarding gerekir)
 */

export const ACTIVE_BUSINESS_COOKIE = 'active_business_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 gün

export interface ActiveStaffResult {
  status: 'active' | 'needs_selection' | 'needs_onboarding'
  staffMember?: any
  businesses?: Array<{ id: string; name: string; role: string }>
}

export function getActiveBusinessIdFromCookie(): string | null {
  const store = cookies()
  return store.get(ACTIVE_BUSINESS_COOKIE)?.value || null
}

/**
 * Kullanıcının tüm aktif personel kayıtlarını çekip hangisinin
 * "aktif" sayılacağını belirler. Cookie varsa onu öncelikle kullanır,
 * yoksa tek kayıt varsa auto-select, birden fazla kayıt varsa seçim ister.
 *
 * İsteğe bağlı `selectFields` ile query'nin hangi kolonları çekeceği
 * kontrol edilebilir; varsayılan `'*, businesses(*)'` dashboard layout için.
 */
export async function resolveActiveStaff(
  supabase: SupabaseClient,
  userId: string,
  selectFields: string = '*, businesses(*)'
): Promise<ActiveStaffResult> {
  const activeBusinessId = getActiveBusinessIdFromCookie()

  const { data: rows } = await supabase
    .from('staff_members')
    .select(selectFields)
    .eq('user_id', userId)
    .eq('is_active', true)

  const staffRows = (rows as any[]) ?? []
  if (staffRows.length === 0) return { status: 'needs_onboarding' }

  // 1. Cookie varsa ve eşleşiyorsa
  if (activeBusinessId) {
    const match = staffRows.find(r => r.business_id === activeBusinessId)
    if (match) return { status: 'active', staffMember: match }
    // Cookie geçersiz — yok say, seçime düş
  }

  // 2. Tek kayıt varsa auto-select
  if (staffRows.length === 1) {
    return { status: 'active', staffMember: staffRows[0] }
  }

  // 3. Birden fazla — kullanıcı seçim yapmalı
  return {
    status: 'needs_selection',
    businesses: staffRows.map(r => ({
      id: r.business_id,
      name: r.businesses?.name || 'İşletme',
      role: r.role,
    })),
  }
}

/**
 * API route'ları için daha kompakt versiyon: sadece businessId'yi döner,
 * bulunamazsa null. Cookie yoksa ve kullanıcının tek işletmesi varsa onu döner.
 */
export async function resolveActiveStaffForApi(
  supabase: SupabaseClient,
  userId: string,
  selectFields: string = 'id, business_id, role, permissions, write_permissions, is_active'
): Promise<{ staff: any | null; status: 'active' | 'needs_selection' | 'needs_onboarding' }> {
  const activeBusinessId = getActiveBusinessIdFromCookie()

  const { data: rows } = await supabase
    .from('staff_members')
    .select(selectFields)
    .eq('user_id', userId)
    .eq('is_active', true)

  const staffRows = (rows as any[]) ?? []
  if (staffRows.length === 0) return { staff: null, status: 'needs_onboarding' }

  if (activeBusinessId) {
    const match = staffRows.find(r => r.business_id === activeBusinessId)
    if (match) return { staff: match, status: 'active' }
  }

  if (staffRows.length === 1) return { staff: staffRows[0], status: 'active' }

  return { staff: null, status: 'needs_selection' }
}

/**
 * Cookie'yi ayarla. Response objesinde `Set-Cookie` header'ı.
 * Server action veya route handler içinden çağrılmalı.
 */
export function buildActiveBusinessCookie(businessId: string): {
  name: string
  value: string
  options: { maxAge: number; path: string; httpOnly: boolean; sameSite: 'lax'; secure: boolean }
} {
  return {
    name: ACTIVE_BUSINESS_COOKIE,
    value: businessId,
    options: {
      maxAge: COOKIE_MAX_AGE,
      path: '/',
      httpOnly: false, // client-side switcher için okunabilir
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    },
  }
}
