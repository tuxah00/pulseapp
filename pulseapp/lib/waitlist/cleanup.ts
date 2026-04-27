import type { SupabaseClient } from '@supabase/supabase-js'
import { sendMessage } from '@/lib/messaging/send'

/**
 * Süresi dolan bekleme listesi kayıtlarını pasifleştir + sıradaki uygun
 * müşteriye otomatik bildirim at (cascade).
 *
 * Akış:
 *   1) is_notified=true, is_active=true, notification_expires_at < now() olan
 *      kayıtları bul. Bunlar 15 dk hold süresinde cevap vermemiş müşteriler.
 *   2) Her birini is_active=false yap (slot hakkı düştü).
 *   3) Aynı boşluğa (notified_for_appointment_id) eşleşen sıradaki bekleyen
 *      müşteriyi bul → bildirim at, hold timer'ını başlat.
 *
 * Cron olmadığı için iki tetikleme noktası var:
 *  1. Bekleme listesi sayfası yüklendiğinde (GET /api/waitlist)
 *  2. Her fill-gap çağrısının başında (POST /api/appointments/[id]/fill-gap)
 *
 * @returns { expired, cascaded } — kaç hold süresi doldu, kaç yeni bildirim gitti
 */
export async function expireStaleWaitlistHolds(
  supabase: SupabaseClient,
  businessId: string,
): Promise<{ expired: number; cascaded: number }> {
  const nowIso = new Date().toISOString()

  // 1) Süresi dolmuş hold'ları bul (önce select, sonra update — appointment_id'yi
  //    almak için; tek update select() ile dönmeyebilir RLS senaryolarında)
  const { data: stale } = await supabase
    .from('waitlist_entries')
    .select('id, notified_for_appointment_id')
    .eq('business_id', businessId)
    .eq('is_notified', true)
    .eq('is_active', true)
    .lt('notification_expires_at', nowIso)

  if (!stale?.length) return { expired: 0, cascaded: 0 }

  // 2) Hepsini pasifleştir
  const staleIds = stale.map(s => s.id)
  await supabase
    .from('waitlist_entries')
    .update({ is_active: false })
    .in('id', staleIds)

  // 3) Cascade — her benzersiz appointment için sıradakine bildir
  const uniqueApts = [...new Set(stale.map(s => s.notified_for_appointment_id).filter(Boolean))]
  let cascaded = 0
  for (const appointmentId of uniqueApts) {
    const ok = await notifyNextWaitlistMatch(supabase, businessId, appointmentId as string)
    if (ok) cascaded++
  }

  return { expired: stale.length, cascaded }
}

/**
 * Belirli bir iptal edilmiş randevu boşluğu için bekleme listesinden sıradaki
 * uygun müşteriye bildirim at. Bulamazsa false döner.
 *
 * Kriter: aktif + henüz bildirim almamış + slot kriterlerine eşleşen ilk kayıt
 * (en uzun süredir bekleyen — created_at ASC).
 */
async function notifyNextWaitlistMatch(
  supabase: SupabaseClient,
  businessId: string,
  appointmentId: string,
): Promise<boolean> {
  // Boşluk bilgilerini iptal edilmiş randevudan al
  const { data: apt } = await supabase
    .from('appointments')
    .select('id, service_id, staff_id, appointment_date, start_time, staff_members(name)')
    .eq('id', appointmentId)
    .eq('business_id', businessId)
    .eq('status', 'cancelled')
    .is('deleted_at', null)
    .single()

  if (!apt) return false

  const slotDate = apt.appointment_date as string
  const slotTime = apt.start_time as string
  const serviceId = apt.service_id as string | null
  const slotStaffId = apt.staff_id as string | null
  const slotStaffName = (apt.staff_members as any)?.name || null

  // İşletme bilgisi (mesaj kişiselleştirme + hold süresi)
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, settings')
    .eq('id', businessId)
    .single()

  if (!biz) return false
  const settings = biz.settings as Record<string, any> | null
  if (settings?.gap_fill_enabled === false) return false
  const holdMinutes = (settings?.gap_fill_hold_minutes as number) ?? 15
  const bizName = biz.name as string
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  // Bekleme listesi — aktif + henüz bildirim almamış + sıralı
  const { data: rawEntries } = await supabase
    .from('waitlist_entries')
    .select('id, customer_id, customer_name, customer_phone, service_id, staff_id, preferred_date, preferred_time_start, customers(id, name, phone)')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .eq('is_notified', false)
    .order('created_at', { ascending: true })

  const matchesSlot = (e: any) =>
    (e.service_id === null || e.service_id === serviceId) &&
    (e.preferred_date === null || e.preferred_date === slotDate) &&
    (e.staff_id === null || e.staff_id === slotStaffId) &&
    (e.preferred_time_start === null || e.preferred_time_start === slotTime)

  const next = (rawEntries || []).find(matchesSlot)
  if (!next) return false

  const customer = next.customers as any
  const phone = customer?.phone || next.customer_phone
  const name = customer?.name || next.customer_name
  const customerId = customer?.id || next.customer_id || null
  if (!phone) return false

  // Aynı slot için zaten bildirim atılmış mı?
  if (customerId) {
    const { data: existing } = await supabase
      .from('gap_fill_notifications')
      .select('id')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .eq('slot_date', slotDate)
      .eq('slot_start_time', slotTime)
      .limit(1)
    if (existing?.length) return false
  }

  // Mesaj — kişiselleştirilmiş + süre limiti
  const slotDateFormatted = new Date(slotDate).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short'
  })
  const slotTimeFormatted = slotTime?.substring(0, 5) || ''
  const parts: string[] = []
  if (next.staff_id && slotStaffName) parts.push(`tercih ettiğiniz ${slotStaffName}`)
  if (next.preferred_date) parts.push(`tercih ettiğiniz ${slotDateFormatted}`)
  if (next.preferred_time_start) parts.push(`tercih ettiğiniz saat ${slotTimeFormatted}`)
  const prefText = parts.length ? parts.join(', ') + ' için ' : ''

  const body =
    `Merhaba ${name}! 👋\n\n` +
    `${bizName} — ${prefText}uygun bir boşluk açıldı.\n\n` +
    `🔗 ${appUrl}/book/${businessId}\n\n` +
    `Bu fırsat ${holdMinutes} dakika boyunca size tutuluyor. Bu süre içinde randevu almazsanız sıradaki kişiye geçer.`

  try {
    await sendMessage({
      to: phone,
      body,
      businessId,
      customerId: customerId || undefined,
      messageType: 'system',
      channel: 'auto',
    })
    const holdUntil = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()
    await Promise.all([
      supabase.from('gap_fill_notifications').insert({
        business_id: businessId,
        appointment_id: appointmentId,
        customer_id: customerId,
        slot_date: slotDate,
        slot_start_time: slotTime,
        service_id: serviceId,
        staff_id: slotStaffId,
        source: 'waitlist',
      }),
      supabase.from('waitlist_entries')
        .update({ is_notified: true, notification_expires_at: holdUntil, notified_for_appointment_id: appointmentId })
        .eq('id', next.id),
    ])
    return true
  } catch {
    return false
  }
}
