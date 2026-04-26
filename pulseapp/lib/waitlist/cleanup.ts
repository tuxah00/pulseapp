import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Süresi dolan bekleme listesi kayıtlarını pasifleştir (lazy cleanup).
 *
 * Şart: is_notified=true, is_active=true, notification_expires_at < now()
 *
 * Bu kayıtlar 15dk'lık "hold" süresinde müşteriden cevap alamamış demek; slotu
 * kaybetmiş sayılırlar. is_active=false yapılır → bir sonraki iptalde fill-gap
 * tarafından atlanır, sıradaki uygun müşteri öne geçer.
 *
 * Cron olmadığı için iki tetikleme noktası var:
 *  1. Bekleme listesi sayfası yüklendiğinde (GET /api/waitlist)
 *  2. Her fill-gap çağrısının başında (POST /api/appointments/[id]/fill-gap)
 *
 * @returns Kaç kayıt pasifleştirildi
 */
export async function expireStaleWaitlistHolds(
  supabase: SupabaseClient,
  businessId: string,
): Promise<number> {
  const nowIso = new Date().toISOString()
  const { data, error } = await supabase
    .from('waitlist_entries')
    .update({ is_active: false })
    .eq('business_id', businessId)
    .eq('is_notified', true)
    .eq('is_active', true)
    .lt('notification_expires_at', nowIso)
    .select('id')

  if (error) return 0
  return data?.length ?? 0
}
