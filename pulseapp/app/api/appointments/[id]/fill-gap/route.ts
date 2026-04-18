import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { logAuditServer } from '@/lib/utils/audit'
import { addMonthsSafe } from '@/lib/utils/date-range'

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

  // İptal edilmiş randevuyu getir
  const { data: apt } = await admin
    .from('appointments')
    .select('id, business_id, service_id, staff_id, appointment_date, start_time, end_time, services(name, duration_minutes), staff_members(id, name)')
    .eq('id', appointmentId)
    .eq('business_id', staff.business_id)
    .eq('status', 'cancelled')
    .is('deleted_at', null)
    .single()

  if (!apt) return NextResponse.json({ error: 'İptal edilmiş randevu bulunamadı' }, { status: 404 })

  // İşletme ayarları
  const { data: biz } = await admin
    .from('businesses')
    .select('name, settings')
    .eq('id', staff.business_id)
    .single()

  const settings = biz?.settings as Record<string, any> | null
  if (!settings?.gap_fill_enabled) {
    return NextResponse.json({ error: 'Boşluk doldurma özelliği kapalı. Ayarlar → Genel bölümünden açabilirsiniz.' }, { status: 400 })
  }

  const lookbackMonths = (settings.gap_fill_lookback_months as number) ?? 6
  const slotDate = apt.appointment_date
  const slotTime = apt.start_time
  const slotEndTime = apt.end_time
  const serviceId = apt.service_id
  const slotStaffId = apt.staff_id
  const slotStaffName = (apt.staff_members as any)?.name || null
  const serviceDuration = (apt.services as any)?.duration_minutes || 30
  const bizName = biz?.name || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const results = {
    notified: 0, waitlistMatches: 0, historicMatches: 0,
    skippedDuplicates: 0, autoBooked: 0,
  }
  const notifiedCustomerIds = new Set<string>()

  // Randevu tarihi için lokalize format
  const slotDateFormatted = new Date(slotDate).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short'
  })
  const slotTimeFormatted = slotTime?.substring(0, 5) || ''

  /**
   * Müşteri tercihine göre kişiselleştirilmiş mesaj.
   * Sadece müşterinin gerçekten tercih ettiği alanı öne çıkarır.
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
      `${bizName} randevunuzda ${prefText}uygun boşluk açıldı.\n\n` +
      `Hemen almak için:\n🔗 ${appUrl}/book/${staff.business_id}\n\n` +
      `İyi günler dileriz!`
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

              notifiedCustomerIds.add(customerId)
              results.autoBooked++
              results.waitlistMatches++
              results.notified++
            }
          } else {
            // Normal bildirim — 15 dk'lık hold, cevap yoksa "sıradakine gönder" butonu
            const holdUntil = new Date(Date.now() + 15 * 60 * 1000).toISOString()
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

            if (customerId) notifiedCustomerIds.add(customerId)
            results.waitlistMatches++
            results.notified++
          }
        } catch { /* bildirim hatası akışı engellemez */ }
      }
    }
  }

  // Waitlist eşleşmesi varsa boşluk tutuldu — historic fallback'e geçme
  const hasWaitlistMatch = results.waitlistMatches > 0

  // ── 2. Geçmiş müşteriler (waitlist eşleşmesi yoksa fallback) ──
  // Waitlist'te eşleşen hasta varsa bildirim zaten ona gitti → historic atlanır.
  if (!hasWaitlistMatch) {
  const lookbackDate = addMonthsSafe(new Date(), -lookbackMonths)
  const lookbackDateStr = lookbackDate.toISOString().split('T')[0]

  const thisMonthStart = new Date()
  thisMonthStart.setDate(1)
  const thisMonthStartStr = thisMonthStart.toISOString().split('T')[0]

  const { data: historicApts } = await admin
    .from('appointments')
    .select('customer_id')
    .eq('business_id', staff.business_id)
    .eq('service_id', serviceId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .gte('appointment_date', lookbackDateStr)
    .lt('appointment_date', thisMonthStartStr)

  const historicCustomerIds = [...new Set((historicApts || []).map(a => a.customer_id).filter(Boolean))]

  if (historicCustomerIds.length) {
    const { data: historicCustomers } = await admin
      .from('customers')
      .select('id, name, phone')
      .in('id', historicCustomerIds)
      .eq('is_active', true)
      .not('phone', 'is', null)

    for (const customer of historicCustomers || []) {
      if (notifiedCustomerIds.has(customer.id)) continue

      const { data: existingNotif } = await admin
        .from('gap_fill_notifications')
        .select('id')
        .eq('business_id', staff.business_id)
        .eq('customer_id', customer.id)
        .eq('slot_date', slotDate)
        .eq('slot_start_time', slotTime)
        .limit(1)

      if (existingNotif?.length) { results.skippedDuplicates++; continue }

      try {
        await sendMessage({
          to: customer.phone!,
          body: buildMessage(customer.name, { staffId: null, date: null, time: null }),
          businessId: staff.business_id,
          customerId: customer.id,
          messageType: 'system',
          channel: 'auto',
        })

        await admin.from('gap_fill_notifications').insert({
          business_id: staff.business_id,
          appointment_id: appointmentId,
          customer_id: customer.id,
          slot_date: slotDate,
          slot_start_time: slotTime,
          service_id: serviceId,
          staff_id: slotStaffId,
          source: 'history',
        })

        notifiedCustomerIds.add(customer.id)
        results.historicMatches++
        results.notified++
      } catch { /* bildirim hatası diğerlerini engellemez */ }
    }
  }
  } // !hasWaitlistMatch

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
      historic: results.historicMatches,
      auto_booked: results.autoBooked,
    },
  })

  return NextResponse.json({ ok: true, ...results })
}
