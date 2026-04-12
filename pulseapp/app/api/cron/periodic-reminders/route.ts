import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'

/**
 * Periyodik Kontrol Hatırlatıcı
 *
 * Her gün çalışır. Hizmetlerin `recommended_interval_days` süresine göre,
 * son randevudan X gün geçmiş müşterilere hatırlatma gönderir.
 *
 * Örnek: "Diş kontrolü" hizmeti recommended_interval_days=180 ise,
 * son diş kontrolünden 180 gün geçen müşterilere SMS gönderilir.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = { checked: 0, sent: 0, errors: 0 }

  // Tüm aktif işletmeleri al
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  for (const biz of businesses || []) {
    const settings = biz.settings as Record<string, any> | null
    if (!settings?.periodic_reminder_enabled) continue

    const advanceDays = (settings.periodic_reminder_advance_days as number) ?? 0

    // Bu işletmedeki periyodik hizmetleri al
    const { data: services } = await supabase
      .from('services')
      .select('id, name, recommended_interval_days')
      .eq('business_id', biz.id)
      .eq('is_active', true)
      .not('recommended_interval_days', 'is', null)
      .gt('recommended_interval_days', 0)

    if (!services?.length) continue

    for (const service of services) {
      const intervalDays = service.recommended_interval_days!
      // Hedef tarih: bugünden intervalDays gün önce (+ advance buffer)
      const targetDate = new Date(now)
      targetDate.setDate(targetDate.getDate() - intervalDays + advanceDays)
      const targetDateStr = targetDate.toISOString().split('T')[0]

      // Bu hizmetten son randevusu targetDate veya öncesinde olan müşterileri bul
      const { data: candidates } = await supabase
        .from('appointments')
        .select('customer_id, customers(id, name, phone)')
        .eq('business_id', biz.id)
        .eq('service_id', service.id)
        .eq('status', 'completed')
        .is('deleted_at', null)
        .lte('appointment_date', targetDateStr)
        .order('appointment_date', { ascending: false })

      if (!candidates?.length) continue

      // Müşteri bazlı gruplama (en son randevu)
      const seen = new Set<string>()
      for (const apt of candidates) {
        const customerId = apt.customer_id
        if (!customerId || seen.has(customerId)) continue
        seen.add(customerId)

        const customer = apt.customers as any
        if (!customer?.phone) continue

        results.checked++

        // Son 30 gün içinde bu müşteri+hizmet için hatırlatma gönderilmiş mi?
        const thirtyDaysAgo = new Date(now)
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

        const { data: recentReminder } = await supabase
          .from('periodic_reminders_sent')
          .select('id')
          .eq('customer_id', customerId)
          .eq('service_id', service.id)
          .gte('sent_at', thirtyDaysAgo.toISOString())
          .limit(1)

        if (recentReminder?.length) continue // Zaten gönderilmiş

        // Son randevusu gerçekten interval'den eski mi? (son randevuyu kontrol et)
        const { data: lastApt } = await supabase
          .from('appointments')
          .select('appointment_date')
          .eq('customer_id', customerId)
          .eq('service_id', service.id)
          .eq('business_id', biz.id)
          .eq('status', 'completed')
          .is('deleted_at', null)
          .order('appointment_date', { ascending: false })
          .limit(1)
          .single()

        if (!lastApt) continue

        const lastDate = new Date(lastApt.appointment_date)
        const daysSince = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince < intervalDays - advanceDays) continue

        // Hatırlatma gönder
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
        const bookingLink = `${appUrl}/book/${biz.id}`

        const body = `Merhaba ${customer.name} 👋\n\n` +
          `${biz.name} olarak hatırlatmak isteriz: Son ${service.name} işleminizin üzerinden ${daysSince} gün geçti.\n\n` +
          `Yeni randevu almak için:\n🔗 ${bookingLink}\n\n` +
          `Sağlıklı günler dileriz! 🌿`

        try {
          await sendMessage({
            to: customer.phone,
            body,
            businessId: biz.id,
            customerId: customerId,
            messageType: 'system',
            channel: 'auto',
          })

          // Gönderim kaydı
          await supabase.from('periodic_reminders_sent').insert({
            business_id: biz.id,
            customer_id: customerId,
            service_id: service.id,
          })

          results.sent++
        } catch {
          results.errors++
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
