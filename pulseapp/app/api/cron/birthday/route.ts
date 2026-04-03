import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/send'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // Türkiye saat dilimi (UTC+3)
  const trHour = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' })).getHours()
  const trDate = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const todayMonth = trDate.getMonth() + 1
  const todayDay = trDate.getDate()
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

    for (const customer of customers) {
      if (!customer.birthday || !customer.phone) continue

      // Birthday string'ini parse et (YYYY-MM-DD format)
      try {
        const parts = customer.birthday.split('-')
        const bMonth = parseInt(parts[1], 10)
        const bDay = parseInt(parts[2], 10)

        if (bMonth !== todayMonth || bDay !== todayDay) continue
      } catch {
        continue
      }

      // Bugün zaten gönderilmiş mi kontrol et
      const { data: existing } = await supabase
        .from('messages')
        .select('id')
        .eq('business_id', business.id)
        .eq('customer_id', customer.id)
        .eq('message_type', 'system')
        .eq('direction', 'outbound')
        .gte('created_at', todayStart)
        .ilike('content', '%doğum gün%')
        .limit(1)

      if (existing && existing.length > 0) {
        report.skipped++
        continue
      }

      // Şablondan mesaj oluştur
      const template = settings.birthday_sms_template ||
        'Doğum gününüz kutlu olsun {name}! 🎂 Size özel sürprizimiz var, bizi ziyaret edin!'
      const message = template.replace(/\{name\}/g, customer.name)

      const result = await sendSMS({
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
