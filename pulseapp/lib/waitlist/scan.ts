import type { SupabaseClient } from '@supabase/supabase-js'
import type { WorkingHours } from '@/types'
import { sendMessage } from '@/lib/messaging/send'

/**
 * Bekleme listesi proaktif tarama.
 *
 * Kullanıcının tercihlerine göre takvimde uygun bir boş slot arar. Bulursa
 * müşteriye bildirim gönderir, hold timer'ını başlatır ve gap_fill_notifications
 * kaydı atar (source='proactive', appointment_id=NULL).
 *
 * Tetikleme noktaları:
 *   1. POST /api/waitlist — yeni kayıt eklendiğinde otomatik
 *   2. POST /api/waitlist/[id]/auto-match — manuel "Otomatik bul" butonu
 *
 * @returns true = bildirim gitti, false = uygun slot yok / hata
 */
export async function scanAndNotifyWaitlistEntry(
  supabase: SupabaseClient,
  businessId: string,
  entryId: string,
  options?: { lookAheadDays?: number },
): Promise<{ matched: boolean; slot?: { date: string; time: string }; reason?: string }> {
  const lookAheadDays = options?.lookAheadDays ?? 14

  // 1) Bekleme listesi kaydını al
  const { data: entry } = await supabase
    .from('waitlist_entries')
    .select('id, business_id, customer_id, customer_name, customer_phone, service_id, staff_id, preferred_date, preferred_time_start, is_active, is_notified, customers(id, name, phone)')
    .eq('id', entryId)
    .eq('business_id', businessId)
    .single()

  if (!entry || !entry.is_active || entry.is_notified) {
    return { matched: false, reason: 'Kayıt bulunamadı veya zaten bildirim gönderilmiş' }
  }

  // 2) İşletme + çalışma saatleri + ayarlar
  const { data: biz } = await supabase
    .from('businesses')
    .select('name, working_hours, settings')
    .eq('id', businessId)
    .single()

  if (!biz) return { matched: false, reason: 'İşletme bulunamadı' }
  const settings = biz.settings as Record<string, any> | null
  if (settings?.gap_fill_enabled === false) {
    return { matched: false, reason: 'Boşluk doldurma kapalı' }
  }
  const workingHours = biz.working_hours as WorkingHours
  const holdMinutes = (settings?.gap_fill_hold_minutes as number) ?? 15
  const bizName = biz.name as string

  // 3) Hizmet süresi
  let duration = 30
  if (entry.service_id) {
    const { data: svc } = await supabase
      .from('services')
      .select('duration_minutes')
      .eq('id', entry.service_id)
      .single()
    if (svc) duration = svc.duration_minutes
  }

  // 4) Hangi günlerde tara?
  const datesToScan: string[] = []
  if (entry.preferred_date) {
    // Sadece tercih edilen gün (geçmişse atla)
    const today = new Date().toISOString().split('T')[0]
    if (entry.preferred_date >= today) datesToScan.push(entry.preferred_date)
  } else {
    // Bugünden N gün ileriye
    const today = new Date()
    for (let i = 0; i < lookAheadDays; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      datesToScan.push(d.toISOString().split('T')[0])
    }
  }

  if (!datesToScan.length) return { matched: false, reason: 'Tercih edilen tarih geçmişte' }

  // 5) Hangi personel(ler)?
  let staffIds: string[] = []
  if (entry.staff_id) {
    staffIds = [entry.staff_id]
  } else {
    const { data: list } = await supabase
      .from('staff_members')
      .select('id')
      .eq('business_id', businessId)
      .eq('is_active', true)
    staffIds = (list || []).map(s => s.id)
  }
  if (!staffIds.length) return { matched: false, reason: 'Aktif personel yok' }

  // 6) Her gün için slot taraması — ilk uygun slotta dur
  const DAY_KEYS: Record<number, keyof WorkingHours> = {
    0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
  }

  // Şu anki zaman — bugünkü slotlar için "geçmişe gönderme" koruması.
  // Buffer: rezervasyon ile randevu arasında en az 30 dk olmalı (müşteri SMS'i
  // okuyup gelmesi için makul süre).
  const SLOT_BUFFER_MINUTES = 30
  const today = new Date().toISOString().split('T')[0]
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes()

  for (const date of datesToScan) {
    const dayKey = DAY_KEYS[new Date(date + 'T00:00:00').getDay()]
    const hours = workingHours?.[dayKey]
    if (!hours) continue // Kapalı gün

    // O gün için randevular + bloklu slotlar + izinli personeller
    const [{ data: appts }, { data: blocked }, { data: shiftOff }] = await Promise.all([
      supabase
        .from('appointments')
        .select('staff_id, start_time, end_time')
        .eq('business_id', businessId)
        .eq('appointment_date', date)
        .in('status', ['pending', 'confirmed'])
        .is('deleted_at', null)
        .in('staff_id', staffIds),
      supabase
        .from('blocked_slots')
        .select('start_time, end_time, staff_id')
        .eq('business_id', businessId)
        .eq('date', date),
      supabase
        .from('shifts')
        .select('staff_id')
        .eq('business_id', businessId)
        .eq('shift_date', date)
        .eq('shift_type', 'off')
        .in('staff_id', staffIds),
    ])

    const offSet = new Set((shiftOff || []).map(s => s.staff_id))
    const availableStaff = staffIds.filter(s => !offSet.has(s))
    if (!availableStaff.length) continue

    // Slot adayları
    const slotCandidates: string[] = []
    if (entry.preferred_time_start) {
      slotCandidates.push(entry.preferred_time_start.substring(0, 5))
    } else {
      // 30 dk granülasyon, çalışma saatleri içinde
      const [openH, openM] = hours.open.split(':').map(Number)
      const [closeH, closeM] = hours.close.split(':').map(Number)
      let cur = openH * 60 + openM
      const end = closeH * 60 + closeM
      while (cur + duration <= end) {
        const h = String(Math.floor(cur / 60)).padStart(2, '0')
        const m = String(cur % 60).padStart(2, '0')
        slotCandidates.push(`${h}:${m}`)
        cur += 30
      }
    }

    const toMin = (t: string) => {
      const [h, m] = t.split(':').map(Number)
      return h * 60 + m
    }

    for (const slot of slotCandidates) {
      const slotMin = toMin(slot)
      const slotEnd = slotMin + duration

      // Çalışma saati içinde mi (preferred_time için ekstra kontrol)?
      if (slotMin < toMin(hours.open) || slotEnd > toMin(hours.close)) continue

      // Bugünse: şu anki zamandan + buffer kadar sonra olmalı (geçmiş/yakın slotları atla)
      if (date === today && slotMin < nowMin + SLOT_BUFFER_MINUTES) continue

      // En az 1 personel müsait mi?
      const matchedStaff = availableStaff.find(sid => {
        // Bloklu slot kontrolü (işletme geneli + personele özel)
        const personalBlocks = (blocked || []).filter(b => b.staff_id === null || b.staff_id === sid)
        const blockedConflict = personalBlocks.some(b => {
          const bStart = toMin(b.start_time)
          const bEnd = toMin(b.end_time)
          return slotMin < bEnd && slotEnd > bStart
        })
        if (blockedConflict) return false

        // Randevu çakışması
        const personalAppts = (appts || []).filter(a => a.staff_id === sid)
        const aptConflict = personalAppts.some(a => {
          const aStart = toMin(a.start_time)
          const aEnd = toMin(a.end_time)
          return slotMin < aEnd && slotEnd > aStart
        })
        return !aptConflict
      })

      if (matchedStaff) {
        // Uygun slot bulundu — bildirim at + takvime placeholder yaz
        const slotTimeFull = `${slot}:00`
        const slotEndH = String(Math.floor(slotEnd / 60)).padStart(2, '0')
        const slotEndM = String(slotEnd % 60).padStart(2, '0')
        const slotEndFull = `${slotEndH}:${slotEndM}:00`

        const customer = entry.customers as any
        const phone = customer?.phone || entry.customer_phone
        const name = customer?.name || entry.customer_name
        let customerId: string | null = customer?.id || entry.customer_id || null
        if (!phone) return { matched: false, reason: 'Telefon yok' }

        // customer_id yoksa: telefonla lookup, yoksa yeni müşteri oluştur.
        // appointments.customer_id NOT NULL — placeholder oluşturmak için zorunlu.
        if (!customerId) {
          const { data: existingCustomer } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId)
            .eq('phone', phone)
            .limit(1)
            .maybeSingle()

          if (existingCustomer) {
            customerId = existingCustomer.id
          } else {
            const { data: newCustomer, error: createErr } = await supabase
              .from('customers')
              .insert({ business_id: businessId, name, phone, segment: 'new' })
              .select('id')
              .single()
            if (createErr || !newCustomer) {
              return { matched: false, reason: `Müşteri kaydı oluşturulamadı: ${createErr?.message || 'bilinmiyor'}` }
            }
            customerId = newCustomer.id
          }

          // Waitlist entry'yi customer_id ile güncelle (geri besleme)
          await supabase
            .from('waitlist_entries')
            .update({ customer_id: customerId })
            .eq('id', entry.id)
        }

        // Aynı slot için zaten bildirim atılmış mı?
        const { data: existing } = await supabase
          .from('gap_fill_notifications')
          .select('id')
          .eq('business_id', businessId)
          .eq('customer_id', customerId)
          .eq('slot_date', date)
          .eq('slot_start_time', slotTimeFull)
          .limit(1)
        if (existing?.length) continue

        // Personel adı (mesaj kişiselleştirme için)
        let staffName: string | null = null
        if (entry.staff_id) {
          const { data: s } = await supabase
            .from('staff_members')
            .select('name')
            .eq('id', entry.staff_id)
            .single()
          staffName = s?.name ?? null
        }

        const slotDateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('tr-TR', {
          day: 'numeric', month: 'long', weekday: 'short'
        })
        const parts: string[] = []
        if (entry.staff_id && staffName) parts.push(`tercih ettiğiniz ${staffName}`)
        if (entry.preferred_date) parts.push(`tercih ettiğiniz ${slotDateFormatted}`)
        if (entry.preferred_time_start) parts.push(`tercih ettiğiniz saat ${slot}`)
        const prefText = parts.length ? parts.join(', ') + ' için ' : ''

        // ─── Placeholder appointment yaz ───
        // status='pending' (mevcut çakışma kontrolleri otomatik dolu sayar)
        // held_until = hold süresi sonu (cleanup bu süre dolanları soft delete edecek)
        // manage_token = müşterinin onay/iptal linki için
        // service_id NULL'dan kurtulmak için: tercih yoksa duration=30 ile herhangi bir
        //   hizmet seçmek yerine NULL bırakıyoruz — booking sayfasında müşteri seçer.
        const holdUntilDate = new Date(Date.now() + holdMinutes * 60 * 1000)
        const holdUntilIso = holdUntilDate.toISOString()
        const tokenExpiresAt = holdUntilIso // Hold süresi = link süresi

        const { data: heldApt, error: insertErr } = await supabase
          .from('appointments')
          .insert({
            business_id: businessId,
            customer_id: customerId,
            service_id: entry.service_id,
            staff_id: matchedStaff,
            appointment_date: date,
            start_time: slotTimeFull,
            end_time: slotEndFull,
            status: 'pending',
            source: 'web',
            held_until: holdUntilIso,
            held_for_waitlist_entry_id: entry.id,
            token_expires_at: tokenExpiresAt,
            notes: 'Bekleme listesi — müşteri onayı bekleniyor',
          })
          .select('id, manage_token')
          .single()

        if (insertErr || !heldApt) {
          // Slot insert başarısız (race condition?) → bu slotu atla, sıradakine bak
          continue
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const manageLink = heldApt.manage_token
          ? `${appUrl}/book/manage/${heldApt.manage_token}`
          : `${appUrl}/book/${businessId}`

        const body =
          `Merhaba ${name}! 👋\n\n` +
          `${bizName} — ${prefText}sizin için ${slotDateFormatted} ${slot} randevu rezerve edildi.\n\n` +
          `Onaylamak için linke tıklayın:\n🔗 ${manageLink}\n\n` +
          `Bu rezervasyon ${holdMinutes} dakika boyunca tutulacak. Bu süre içinde onaylamazsanız iptal edilir ve sıradaki kişiye geçilir.`

        try {
          await sendMessage({
            to: phone,
            body,
            businessId,
            customerId: customerId ?? undefined,
            messageType: 'system',
            channel: 'auto',
          })

          await Promise.all([
            supabase.from('gap_fill_notifications').insert({
              business_id: businessId,
              appointment_id: heldApt.id,
              customer_id: customerId,
              slot_date: date,
              slot_start_time: slotTimeFull,
              service_id: entry.service_id,
              staff_id: matchedStaff,
              source: 'proactive',
            }),
            supabase.from('waitlist_entries')
              .update({
                is_notified: true,
                notification_expires_at: holdUntilIso,
                notified_for_appointment_id: heldApt.id,
              })
              .eq('id', entry.id),
          ])

          return { matched: true, slot: { date, time: slotTimeFull } }
        } catch (sendErr) {
          // SMS başarısız — placeholder appointment'ı geri al (rollback)
          await supabase
            .from('appointments')
            .update({ deleted_at: new Date().toISOString() })
            .eq('id', heldApt.id)
          return { matched: false, reason: 'Bildirim hatası — slot serbest bırakıldı' }
        }
      }
    }
  }

  return { matched: false, reason: `${datesToScan.length} gün tarandı, uygun slot yok` }
}
