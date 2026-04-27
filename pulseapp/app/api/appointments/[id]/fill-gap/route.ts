import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { logAuditServer } from '@/lib/utils/audit'
import { expireStaleWaitlistHolds } from '@/lib/waitlist/cleanup'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const appointmentId = params.id
  const admin = createAdminClient()

  // Body'de freedSlot varsa erteleme/silme akışı: cancelled kontrolünü atla,
  // slot bilgisini doğrudan body'den al. Yoksa eski akış (cancelled randevu).
  let freedSlot: {
    date: string
    time: string
    endTime: string
    staffId: string | null
    serviceId: string | null
  } | null = null
  let trigger: 'cancel' | 'reschedule' | 'delete' = 'cancel'
  try {
    const body = await request.json().catch(() => null)
    if (body?.freedSlot) {
      freedSlot = body.freedSlot
      trigger = body.trigger ?? 'reschedule'
    }
  } catch { /* body opsiyonel */ }

  // Lazy cleanup — süresi dolmuş hold'ları pasifleştir, böylece bu fill-gap
  // çağrısı sıradaki müşteriye atlayabilir (15dk içinde cevap vermeyenler skip)
  await expireStaleWaitlistHolds(admin, staff.business_id)

  // Slot bilgisini ya body'den (erteleme/silme) ya da DB'den (iptal) al
  let slotDate: string
  let slotTime: string
  let slotEndTime: string
  let serviceId: string | null
  let slotStaffId: string | null
  let slotStaffName: string | null = null
  let serviceDuration = 30

  if (freedSlot) {
    // Erteleme/silme: slot bilgisi body'de
    slotDate = freedSlot.date
    slotTime = freedSlot.time
    slotEndTime = freedSlot.endTime
    serviceId = freedSlot.serviceId
    slotStaffId = freedSlot.staffId

    // Personel adı + hizmet süresi DB'den çekilir (mesaj kişiselleştirmesi için)
    if (slotStaffId) {
      const { data: s } = await admin.from('staff_members').select('name').eq('id', slotStaffId).single()
      slotStaffName = s?.name ?? null
    }
    if (serviceId) {
      const { data: svc } = await admin.from('services').select('duration_minutes').eq('id', serviceId).single()
      serviceDuration = svc?.duration_minutes ?? 30
    }
  } else {
    // İptal akışı: cancelled randevuyu getir
    const { data: apt } = await admin
      .from('appointments')
      .select('id, business_id, service_id, staff_id, appointment_date, start_time, end_time, services(name, duration_minutes), staff_members(id, name)')
      .eq('id', appointmentId)
      .eq('business_id', staff.business_id)
      .eq('status', 'cancelled')
      .is('deleted_at', null)
      .single()

    if (!apt) return NextResponse.json({ error: 'İptal edilmiş randevu bulunamadı' }, { status: 404 })

    slotDate = apt.appointment_date
    slotTime = apt.start_time
    slotEndTime = apt.end_time
    serviceId = apt.service_id
    slotStaffId = apt.staff_id
    slotStaffName = (apt.staff_members as any)?.name || null
    serviceDuration = (apt.services as any)?.duration_minutes || 30
  }

  // İşletme ayarları
  const { data: biz } = await admin
    .from('businesses')
    .select('name, settings')
    .eq('id', staff.business_id)
    .single()

  const settings = biz?.settings as Record<string, any> | null
  // Default açık — sadece explicit false ise kapat (null/undefined = aktif).
  // Yeni işletmeler otomatik aktif gelir, kullanıcı isterse Ayarlar → Genel'den kapatabilir.
  if (settings?.gap_fill_enabled === false) {
    return NextResponse.json({ error: 'Boşluk doldurma özelliği kapalı. Ayarlar → Genel bölümünden açabilirsiniz.' }, { status: 400 })
  }

  const bizName = biz?.name || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  // Hold süresi (dakika) — bu süre içinde randevu alınmazsa sıradakine geçilir.
  // Ayarlardan değiştirilebilir, varsayılan 15 dk.
  const holdMinutes = (settings?.gap_fill_hold_minutes as number) ?? 15

  const results = {
    notified: 0, waitlistMatches: 0,
    skippedDuplicates: 0, autoBooked: 0,
  }

  // Randevu tarihi için lokalize format
  const slotDateFormatted = new Date(slotDate).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short'
  })
  const slotTimeFormatted = slotTime?.substring(0, 5) || ''

  /**
   * Müşteri tercihine göre kişiselleştirilmiş mesaj.
   * Sadece müşterinin gerçekten tercih ettiği alanı öne çıkarır + süre limiti belirtir.
   */
  const buildMessage = (
    customerName: string,
    pref: { staffId?: string | null; date?: string | null; time?: string | null },
  ) => {
    const parts: string[] = []
    if (pref.staffId && slotStaffName) parts.push(`tercih ettiğiniz ${slotStaffName}`)
    if (pref.date) parts.push(`tercih ettiğiniz ${slotDateFormatted}`)
    if (pref.time) parts.push(`tercih ettiğiniz saat ${slotTimeFormatted}`)

    const prefText = parts.length
      ? parts.join(', ') + ' için '
      : ''

    return (
      `Merhaba ${customerName}! 👋\n\n` +
      `${bizName} — ${prefText}uygun bir boşluk açıldı.\n\n` +
      `🔗 ${appUrl}/book/${staff.business_id}\n\n` +
      `Bu fırsat ${holdMinutes} dakika boyunca size tutuluyor. Bu süre içinde randevu almazsanız sıradaki kişiye geçer.`
    )
  }

  /** Otomatik randevu alındığında gönderilen mesaj */
  const buildAutoBookMessage = (customerName: string) =>
    `Merhaba ${customerName}! 👋\n\n` +
    `${bizName} — tercihlerinize uygun boşluk oluştu. Sizin için ${slotDateFormatted} ${slotTimeFormatted} ` +
    `için randevunuz otomatik olarak oluşturuldu (onay bekliyor).\n\n` +
    `İyi günler dileriz!`

  // ── 1. Bekleme listesi: eşleşme filtresi ──
  // Supabase'in zincirli `.or()` çağrıları birbirini override ediyor → JS tarafında
  // 4 kritere AND filtresi uyguluyoruz. Her kriter: ya NULL (fark etmez) ya da slot
  // değerine eşit olmalı.
  const { data: rawWaitlistEntries } = await admin
    .from('waitlist_entries')
    .select('id, customer_id, customer_name, customer_phone, service_id, staff_id, preferred_date, preferred_time_start, auto_book_on_match, notification_expires_at, is_notified, customers(id, name, phone)')
    .eq('business_id', staff.business_id)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const matchesSlot = (e: any) =>
    (e.service_id === null || e.service_id === serviceId) &&
    (e.preferred_date === null || e.preferred_date === slotDate) &&
    (e.staff_id === null || e.staff_id === slotStaffId) &&
    (e.preferred_time_start === null || e.preferred_time_start === slotTime)

  // Eşleşen ve henüz bildirim atılmamış ilk entry (sıralı bildirim — parallel değil)
  const waitlistEntries = (rawWaitlistEntries || []).filter(matchesSlot)
  const nextEntry = waitlistEntries.find(e => !e.is_notified)

  if (nextEntry) {
    const customer = nextEntry.customers as any
    const phone = customer?.phone || nextEntry.customer_phone
    const name = customer?.name || nextEntry.customer_name
    const customerId = customer?.id || nextEntry.customer_id || null

    if (phone) {
      // Duplicate kontrolü (aynı müşteri aynı slota daha önce bildirildi mi?)
      let duplicate = false
      if (customerId) {
        const { data: existingNotif } = await admin
          .from('gap_fill_notifications')
          .select('id')
          .eq('business_id', staff.business_id)
          .eq('customer_id', customerId)
          .eq('slot_date', slotDate)
          .eq('slot_start_time', slotTime)
          .limit(1)
        duplicate = !!existingNotif?.length
      }

      if (duplicate) {
        results.skippedDuplicates++
      } else {
        const pref = {
          staffId: nextEntry.staff_id as string | null,
          date: nextEntry.preferred_date as string | null,
          time: nextEntry.preferred_time_start as string | null,
        }

        try {
          // auto_book_on_match: Otomatik randevu aç, sıradakine bildirim gitmez
          if (nextEntry.auto_book_on_match && customerId) {
            const { data: autoApt, error: autoErr } = await admin
              .from('appointments')
              .insert({
                business_id: staff.business_id,
                customer_id: customerId,
                service_id: serviceId,
                staff_id: slotStaffId,
                appointment_date: slotDate,
                start_time: slotTime,
                end_time: slotEndTime,
                status: 'pending',
                notes: 'Bekleme listesinden otomatik oluşturuldu',
              })
              .select('id')
              .single()

            if (!autoErr && autoApt) {
              await sendMessage({
                to: phone,
                body: buildAutoBookMessage(name),
                businessId: staff.business_id,
                customerId,
                messageType: 'system',
                channel: 'auto',
              })

              await Promise.all([
                admin.from('gap_fill_notifications').insert({
                  business_id: staff.business_id,
                  appointment_id: appointmentId,
                  customer_id: customerId,
                  slot_date: slotDate,
                  slot_start_time: slotTime,
                  service_id: serviceId,
                  staff_id: slotStaffId,
                  source: 'waitlist',
                }),
                admin.from('waitlist_entries')
                  .update({ is_notified: true, is_active: false, notification_expires_at: null })
                  .eq('id', nextEntry.id),
              ])

              results.autoBooked++
              results.waitlistMatches++
              results.notified++
            }
          } else {
            // Normal bildirim — holdMinutes kadar hold, cevap yoksa "sıradakine gönder" butonu
            const holdUntil = new Date(Date.now() + holdMinutes * 60 * 1000).toISOString()
            await sendMessage({
              to: phone,
              body: buildMessage(name, pref),
              businessId: staff.business_id,
              customerId: customerId || undefined,
              messageType: 'system',
              channel: 'auto',
            })

            await Promise.all([
              admin.from('gap_fill_notifications').insert({
                business_id: staff.business_id,
                appointment_id: appointmentId,
                customer_id: customerId,
                slot_date: slotDate,
                slot_start_time: slotTime,
                service_id: serviceId,
                staff_id: slotStaffId,
                source: 'waitlist',
              }),
              admin.from('waitlist_entries')
                .update({ is_notified: true, notification_expires_at: holdUntil, notified_for_appointment_id: appointmentId })
                .eq('id', nextEntry.id),
            ])

            results.waitlistMatches++
            results.notified++
          }
        } catch { /* bildirim hatası akışı engellemez */ }
      }
    }
  }

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'send',
    resource: 'appointment',
    resourceId: appointmentId,
    details: {
      type: 'gap_fill',
      notified: results.notified,
      waitlist: results.waitlistMatches,
      auto_booked: results.autoBooked,
    },
  })

  return NextResponse.json({ ok: true, ...results })
}
