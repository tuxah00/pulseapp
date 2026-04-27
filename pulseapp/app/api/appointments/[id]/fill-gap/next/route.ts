import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { logAuditServer } from '@/lib/utils/audit'

/**
 * POST /api/appointments/[id]/fill-gap/next
 *
 * Sıralı bekleme bildirimi — mevcut "hold"lu hastayı pas geçip sıradakini bilgilendirir.
 * - Bu boşluk için notification_expires_at dolmuş ya da işletme manuel "sıradakine gönder"
 *   dediğinde çağrılır.
 * - İlk is_notified=true entry is_active=false yapılır.
 * - Ardından kalan eşleşenler içinden (is_notified=false) ilkine bildirim gönderilir.
 */
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

  const { data: apt } = await admin
    .from('appointments')
    .select('id, business_id, service_id, staff_id, appointment_date, start_time, end_time, services(name, duration_minutes), staff_members(id, name)')
    .eq('id', appointmentId)
    .eq('business_id', staff.business_id)
    .eq('status', 'cancelled')
    .is('deleted_at', null)
    .single()

  if (!apt) return NextResponse.json({ error: 'İptal edilmiş randevu bulunamadı' }, { status: 404 })

  const { data: biz } = await admin
    .from('businesses')
    .select('name, settings')
    .eq('id', staff.business_id)
    .single()

  const settings = biz?.settings as Record<string, any> | null
  if (!settings?.gap_fill_enabled) {
    return NextResponse.json({ error: 'Boşluk doldurma özelliği kapalı.' }, { status: 400 })
  }

  const slotDate = apt.appointment_date
  const slotTime = apt.start_time
  const slotEndTime = apt.end_time
  const serviceId = apt.service_id
  const slotStaffId = apt.staff_id
  const slotStaffName = (apt.staff_members as any)?.name || null
  const bizName = biz?.name || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const holdMinutes = (settings?.gap_fill_hold_minutes as number) ?? 15

  const slotDateFormatted = new Date(slotDate).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short'
  })
  const slotTimeFormatted = slotTime?.substring(0, 5) || ''

  const buildMessage = (
    customerName: string,
    pref: { staffId?: string | null; date?: string | null; time?: string | null },
  ) => {
    const parts: string[] = []
    if (pref.staffId && slotStaffName) parts.push(`tercih ettiğiniz ${slotStaffName}`)
    if (pref.date) parts.push(`tercih ettiğiniz ${slotDateFormatted}`)
    if (pref.time) parts.push(`tercih ettiğiniz saat ${slotTimeFormatted}`)
    const prefText = parts.length ? parts.join(', ') + ' için ' : ''
    return (
      `Merhaba ${customerName}! 👋\n\n` +
      `${bizName} — ${prefText}uygun bir boşluk açıldı.\n\n` +
      `🔗 ${appUrl}/book/${staff.business_id}\n\n` +
      `Bu fırsat ${holdMinutes} dakika boyunca size tutuluyor. Bu süre içinde randevu almazsanız sıradaki kişiye geçer.`
    )
  }

  const buildAutoBookMessage = (customerName: string) =>
    `Merhaba ${customerName}! 👋\n\n` +
    `${bizName} — tercihlerinize uygun boşluk oluştu. Sizin için ${slotDateFormatted} ${slotTimeFormatted} ` +
    `için randevunuz otomatik olarak oluşturuldu (onay bekliyor).\n\n` +
    `İyi günler dileriz!`

  const { data: rawEntries } = await admin
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

  const entries = (rawEntries || []).filter(matchesSlot)

  // Şu an hold'da olan entry'yi pas geç
  const heldEntry = entries.find(e => e.is_notified)
  if (heldEntry) {
    await admin.from('waitlist_entries')
      .update({ is_active: false, notification_expires_at: null })
      .eq('id', heldEntry.id)
  }

  // Sıradaki aktif entry'ye bildirim
  const nextEntry = entries.find(e => !e.is_notified)
  if (!nextEntry) {
    return NextResponse.json({ ok: true, skippedHeld: !!heldEntry, notified: 0, message: 'Sırada eşleşen hasta kalmadı' })
  }

  const customer = nextEntry.customers as any
  const phone = customer?.phone || nextEntry.customer_phone
  const name = customer?.name || nextEntry.customer_name
  const customerId = customer?.id || nextEntry.customer_id || null

  if (!phone) {
    return NextResponse.json({ ok: true, skippedHeld: !!heldEntry, notified: 0, message: 'Sıradaki kaydın telefonu yok' })
  }

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
    return NextResponse.json({ ok: true, skippedHeld: !!heldEntry, notified: 0, message: 'Sıradaki hastaya zaten bildirim atılmış' })
  }

  const pref = {
    staffId: nextEntry.staff_id as string | null,
    date: nextEntry.preferred_date as string | null,
    time: nextEntry.preferred_time_start as string | null,
  }

  let autoBooked = false
  try {
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
        autoBooked = true
      }
    }

    if (!autoBooked) {
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
    }
  } catch { /* bildirim hatası akışı engellemez */ }

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'send',
    resource: 'appointment',
    resourceId: appointmentId,
    details: { type: 'gap_fill_next', skippedHeld: !!heldEntry, autoBooked },
  })

  return NextResponse.json({ ok: true, skippedHeld: !!heldEntry, notified: 1, autoBooked })
}
