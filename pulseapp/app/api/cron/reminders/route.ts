import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = { sent24h: 0, sent2h: 0, errors: 0 }

  // 24 saat sonrası için hatırlatma
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowDate = tomorrow.toISOString().split('T')[0]

  const { data: appointments24h } = await supabase
    .from('appointments')
    .select(`
      id, appointment_date, start_time, notes,
      customers(id, name, phone),
      services(name),
      businesses(id, name, settings)
    `)
    .eq('appointment_date', tomorrowDate)
    .in('status', ['confirmed', 'pending'])
    .eq('reminder_24h_sent', false)

  for (const apt of appointments24h || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.reminder_24h) continue

    try {
      await supabase
        .from('appointments')
        .update({ reminder_24h_sent: true })
        .eq('id', apt.id)
      results.sent24h++
    } catch {
      results.errors++
    }
  }

  // 2 saat sonrası için hatırlatma
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const todayDate = now.toISOString().split('T')[0]
  const targetHour = String(twoHoursLater.getHours()).padStart(2, '0')
  const targetMinute = String(twoHoursLater.getMinutes()).padStart(2, '0')
  const windowStart = `${targetHour}:${targetMinute}:00`

  const windowEnd = new Date(twoHoursLater.getTime() + 15 * 60 * 1000)
  const endHour = String(windowEnd.getHours()).padStart(2, '0')
  const endMinute = String(windowEnd.getMinutes()).padStart(2, '0')
  const windowEndStr = `${endHour}:${endMinute}:00`

  const { data: appointments2h } = await supabase
    .from('appointments')
    .select(`
      id, appointment_date, start_time, notes,
      customers(id, name, phone),
      services(name),
      businesses(id, name, settings)
    `)
    .eq('appointment_date', todayDate)
    .gte('start_time', windowStart)
    .lte('start_time', windowEndStr)
    .in('status', ['confirmed', 'pending'])
    .eq('reminder_2h_sent', false)

  for (const apt of appointments2h || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.reminder_2h) continue

    try {
      await supabase
        .from('appointments')
        .update({ reminder_2h_sent: true })
        .eq('id', apt.id)
      results.sent2h++
    } catch {
      results.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
