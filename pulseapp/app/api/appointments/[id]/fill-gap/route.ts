import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { logAuditServer } from '@/lib/utils/audit'

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
    .select('id, business_id, service_id, staff_id, appointment_date, start_time, services(name)')
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
  const serviceId = apt.service_id
  const serviceName = (apt.services as any)?.name || 'hizmet'
  const bizName = biz?.name || ''
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

  const results = { notified: 0, waitlistMatches: 0, historicMatches: 0, skippedDuplicates: 0 }
  const notifiedCustomerIds = new Set<string>()

  // Randevu tarihi için lokalize format
  const slotDateFormatted = new Date(slotDate).toLocaleDateString('tr-TR', {
    day: 'numeric', month: 'long', weekday: 'short'
  })
  const slotTimeFormatted = slotTime?.substring(0, 5) || ''

  const buildMessage = (customerName: string) =>
    `Merhaba ${customerName}! 👋\n\n` +
    `${bizName} randevunuzda ${slotDateFormatted} ${slotTimeFormatted} için ` +
    `${serviceName} rezervasyonu açıldı.\n\n` +
    `Hemen almak için:\n🔗 ${appUrl}/book/${staff.business_id}\n\n` +
    `İyi günler dileriz!`

  // ── 1. Bekleme listesi ──
  const { data: waitlistEntries } = await admin
    .from('waitlist_entries')
    .select('id, customer_id, customers(id, name, phone)')
    .eq('business_id', staff.business_id)
    .eq('is_active', true)
    .eq('is_notified', false)
    .or(`service_id.eq.${serviceId},service_id.is.null`)
    .or(`preferred_date.eq.${slotDate},preferred_date.is.null`)
    .order('created_at', { ascending: true })

  for (const entry of waitlistEntries || []) {
    const customer = entry.customers as any
    if (!customer?.phone || notifiedCustomerIds.has(customer.id)) continue

    // Duplicate kontrolü
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
        to: customer.phone,
        body: buildMessage(customer.name),
        businessId: staff.business_id,
        customerId: customer.id,
        messageType: 'system',
        channel: 'auto',
      })

      await Promise.all([
        admin.from('gap_fill_notifications').insert({
          business_id: staff.business_id,
          appointment_id: appointmentId,
          customer_id: customer.id,
          slot_date: slotDate,
          slot_start_time: slotTime,
          service_id: serviceId,
          staff_id: apt.staff_id,
          source: 'waitlist',
        }),
        admin.from('waitlist_entries').update({ is_notified: true }).eq('id', entry.id),
      ])

      notifiedCustomerIds.add(customer.id)
      results.waitlistMatches++
      results.notified++
    } catch { /* bildirim hatası diğerlerini engellemez */ }
  }

  // ── 2. Geçmiş müşteriler (son X ay içinde bu hizmeti alanlar, bu ay gelmeyenler) ──
  const lookbackDate = new Date()
  lookbackDate.setMonth(lookbackDate.getMonth() - lookbackMonths)
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
          body: buildMessage(customer.name),
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
          staff_id: apt.staff_id,
          source: 'history',
        })

        notifiedCustomerIds.add(customer.id)
        results.historicMatches++
        results.notified++
      } catch { /* bildirim hatası diğerlerini engellemez */ }
    }
  }

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'send',
    resource: 'appointment',
    resourceId: appointmentId,
    details: { type: 'gap_fill', notified: results.notified, waitlist: results.waitlistMatches, historic: results.historicMatches },
  })

  return NextResponse.json({ ok: true, ...results })
}
