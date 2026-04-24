import type { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * Aktif kullanıcıya ait staff_members kaydını döner (kampanya route'ları için ortak yardımcı).
 *
 * Not: Bu fonksiyon önceden `app/api/campaigns/route.ts` içinde export ediliyordu.
 * Next.js App Router route dosyaları sadece HTTP handler export'larına izin verdiği
 * için (GET/POST/PATCH/DELETE/OPTIONS/HEAD/...), buraya taşındı. `campaigns`,
 * `campaigns/send` ve `campaigns/estimate` hepsi buradan import eder.
 */
export async function getStaffInfo(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  return staff
}
