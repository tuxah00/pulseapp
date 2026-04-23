import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: arka plan görevi, aktif kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { isBirthdayToday } from '@/lib/utils/birthday'

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const supabase = createAdminClient()
  const now = new Date()

  // Türkiye saat dilimi (UTC+3)
  const trDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const trHour = trDate.getHours()
  const todayStart = new Date(trDate.getFullYear(), trDate.getMonth(), trDate.getDate()).toISOString()

  const report = { sent: 0, skipped: 0, errors: 0 }

  // Tüm aktif işletmeleri çek
  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  if (!businesses || businesses.length === 0) {
    return NextResponse.json({ ok: true, timestamp: now.toISOString(), birthday: report })
  }

  for (const business of businesses) {
    const settings = business.settings as Record<string, any> | null
    if (!settings?.birthday_sms_enabled) continue

    // Saat kapısı: işletmenin seçtiği saatten önce gönderme
    const sendHour = settings.birthday_sms_hour ?? 9
    if (trHour < sendHour) continue

    // İşletmenin aktif müşterilerini çek (birthday dolu olanlar)
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, birthday')
      .eq('business_id', business.id)
      .eq('is_active', true)
      .not('birthday', 'is', null)

    if (!customers || customers.length === 0) continue

    // Bugün doğum günü olanları filtrele (29 Şubat artık yıl fallback'i dahil)
    const birthdayCustomers = customers.filter(c => {
      if (!c.birthday || !c.phone) return false
      return isBirthdayToday(c.birthday, trDate)
    })

    if (birthdayCustomers.length === 0) continue

    // Bugün zaten gönderilmiş olanları tek sorguda çek
    const birthdayIds = birthdayCustomers.map(c => c.id)
    const { data: sentToday } = await supabase
      .from('messages')
      .select('customer_id')
      .eq('business_id', business.id)
      .eq('message_type', 'system')
      .eq('direction', 'outbound')
      .gte('created_at', todayStart)
      .ilike('content', '%doğum gün%')
      .in('customer_id', birthdayIds)

    const sentIds = new Set((sentToday || []).map(m => m.customer_id))

    const template = settings.birthday_sms_template ||
      'Doğum gününüz kutlu olsun {name}! 🎂 Size özel sürprizimiz var, bizi ziyaret edin!'

    for (const customer of birthdayCustomers) {
      if (sentIds.has(customer.id)) {
        report.skipped++
        continue
      }

      const message = template.replace(/\{name\}/g, customer.name)
      const result = await sendMessage({
        to: customer.phone,
        body: message,
        businessId: business.id,
        customerId: customer.id,
        messageType: 'system',
      })

      if (result.success) {
        report.sent++
      } else {
        report.errors++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    birthday: report,
  })
}
