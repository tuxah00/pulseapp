import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/send'
import type { CustomerSegment } from '@/types'
import type { BusinessRow } from '@/types/db'

type ReminderCustomer = { id: string; name: string; phone: string | null }
type ReminderBusiness = { id: string; name: string; settings: BusinessRow['settings'] }
type ReminderAppointment = {
  id: string
  appointment_date: string | null
  start_time: string | null
  notes: string | null
  customers: ReminderCustomer | null
  services: { name: string } | null
  businesses: ReminderBusiness | null
}

type ReviewBusiness = ReminderBusiness & { google_maps_url: string | null }
type ReviewAppointment = {
  id: string
  updated_at: string | null
  customers: ReminderCustomer | null
  businesses: ReviewBusiness | null
}

type WinbackBusiness = Pick<BusinessRow, 'id' | 'name' | 'settings'>
type WinbackCustomer = {
  id: string
  name: string
  phone: string | null
  total_visits: number | null
  last_visit_at: string | null
  segment: CustomerSegment | null
}

type CancelledAppointment = {
  appointment_date: string
  start_time: string
  end_time: string
  staff_id: string | null
  service_id: string | null
  business_id: string
}

type WaitlistEntry = {
  id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  preferred_date: string | null
  is_notified: boolean
  is_active: boolean
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  // ── 1. Reminders ──────────────────────────────────────────────────────────
  const reminders = { sent24h: 0, sent2h: 0, errors: 0 }

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

  for (const apt of (appointments24h || []) as unknown as ReminderAppointment[]) {
    const customer = apt.customers
    const business = apt.businesses

    if (!customer?.phone || !business?.id) continue
    const settings = business.settings as Record<string, unknown> | null
    if (!settings?.reminder_24h) continue

    await supabase.from('appointments').update({ reminder_24h_sent: true }).eq('id', apt.id)
    reminders.sent24h++
  }

  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
  const todayDate = now.toISOString().split('T')[0]
  const windowStart = `${String(twoHoursLater.getHours()).padStart(2, '0')}:${String(twoHoursLater.getMinutes()).padStart(2, '0')}:00`
  const windowEnd = new Date(twoHoursLater.getTime() + 15 * 60 * 1000)
  const windowEndStr = `${String(windowEnd.getHours()).padStart(2, '0')}:${String(windowEnd.getMinutes()).padStart(2, '0')}:00`

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

  for (const apt of (appointments2h || []) as unknown as ReminderAppointment[]) {
    const customer = apt.customers
    const business = apt.businesses

    if (!customer?.phone || !business?.id) continue
    const settings = business.settings as Record<string, unknown> | null
    if (!settings?.reminder_2h) continue

    await supabase.from('appointments').update({ reminder_2h_sent: true }).eq('id', apt.id)
    reminders.sent2h++
  }

  // ── 2. Review Requests ────────────────────────────────────────────────────
  const reviewRequests = { sent: 0, errors: 0 }

  const { data: completedApts } = await supabase
    .from('appointments')
    .select(`
      id, updated_at,
      customers(id, name, phone),
      businesses(id, name, google_maps_url, settings)
    `)
    .eq('status', 'completed')
    .eq('review_requested', false)

  for (const apt of (completedApts || []) as unknown as ReviewAppointment[]) {
    const customer = apt.customers
    const business = apt.businesses

    if (!customer?.phone || !business?.id) continue
    const settings = business.settings as Record<string, unknown> | null
    if (!settings?.auto_review_request) continue

    const delayMinutes = (settings.review_request_delay_minutes as number | undefined) ?? 30
    const readyAt = new Date(new Date(apt.updated_at ?? now).getTime() + delayMinutes * 60 * 1000)
    if (readyAt > now) continue

    const googleLink = business.google_maps_url
    const message = googleLink
      ? `Merhaba ${customer.name}! 😊\n\n${business.name} ziyaretiniz için teşekkürler.\n⭐ Google'da yorum yapın:\n${googleLink}`
      : `Merhaba ${customer.name}! 😊\n\n${business.name} ziyaretiniz için teşekkürler. Bizi tavsiye etmeyi unutmayın! 🙏`

    const smsResult = await sendSMS({
      to: customer.phone, body: message,
      businessId: business.id, customerId: customer.id, messageType: 'system',
    })

    await supabase.from('appointments').update({ review_requested: true }).eq('id', apt.id)
    if (smsResult.success) reviewRequests.sent++
    else reviewRequests.errors++
  }

  // ── 3. Winback + Segment Update ───────────────────────────────────────────
  const winback = { segmentsUpdated: 0, errors: 0 }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  for (const business of (businesses || []) as WinbackBusiness[]) {
    const settings = business.settings as Record<string, unknown> | null
    const winbackDays: number = (settings?.winback_days as number | undefined) ?? 60

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, total_visits, last_visit_at, segment')
      .eq('business_id', business.id)
      .eq('is_active', true)

    for (const customer of (customers || []) as WinbackCustomer[]) {
      const visits = customer.total_visits ?? 0
      const lastVisit = customer.last_visit_at ? new Date(customer.last_visit_at) : null

      let newSegment: CustomerSegment
      if (visits === 0) {
        newSegment = 'new'
      } else if (visits < 5) {
        newSegment = 'regular'
      } else {
        newSegment = 'vip'
      }

      if (lastVisit) {
        const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince >= winbackDays * 2) {
          newSegment = 'lost'
        } else if (daysSince >= winbackDays) {
          newSegment = 'risk'
        }
      }

      if (newSegment === customer.segment) continue

      try {
        await supabase.from('customers').update({ segment: newSegment }).eq('id', customer.id)
        winback.segmentsUpdated++
      } catch {
        winback.errors++
      }
    }
  }

  // ── 4. No-Show Skor Güncelleme ────────────────────────────────────────────
  const noShowScoring = { updated: 0 }

  // Dünkü no_show randevuları olan müşterilerin skorunu güncelle
  const yesterdayDate = new Date(now)
  yesterdayDate.setDate(yesterdayDate.getDate() - 1)
  const yesterdayStr = yesterdayDate.toISOString().split('T')[0]

  const { data: noShowApts } = await supabase
    .from('appointments')
    .select('customer_id')
    .eq('appointment_date', yesterdayStr)
    .eq('status', 'no_show')
    .is('deleted_at', null)

  const noShowCustomerIds = [...new Set((noShowApts || []).map(a => a.customer_id).filter(Boolean))]

  for (const custId of noShowCustomerIds) {
    // Müşterinin toplam no_show sayısı ve total randevu sayısını al
    const { data: stats } = await supabase
      .from('appointments')
      .select('status')
      .eq('customer_id', custId)
      .is('deleted_at', null)
      .in('status', ['completed', 'no_show'])

    if (!stats || stats.length === 0) continue

    const totalDone = stats.length
    const totalNoShow = stats.filter(s => s.status === 'no_show').length
    // Skor: no_show yüzdesi (0-100)
    const score = Math.round((totalNoShow / totalDone) * 100)

    await supabase
      .from('customers')
      .update({ no_show_score: score, total_no_shows: totalNoShow })
      .eq('id', custId)

    noShowScoring.updated++
  }

  // ── 5. Bekleme Listesi Bildirimleri ───────────────────────────────────────
  const waitlistNotifs = { sent: 0, errors: 0 }

  // İptal/no_show olan bugünkü randevuların slotlarını kontrol et
  const todayStr = now.toISOString().split('T')[0]
  const { data: cancelledToday } = await supabase
    .from('appointments')
    .select('appointment_date, start_time, end_time, staff_id, service_id, business_id')
    .in('status', ['cancelled', 'no_show'])
    .eq('appointment_date', todayStr)

  for (const apt of (cancelledToday || []) as CancelledAppointment[]) {
    // Aynı tarih/saat/personel için bekleme listesi kayıtlarını bul
    let wlQuery = supabase
      .from('waitlist_entries')
      .select('*')
      .eq('business_id', apt.business_id)
      .eq('is_notified', false)
      .eq('is_active', true)

    wlQuery = wlQuery.eq('preferred_date', apt.appointment_date)

    const { data: waitlistItems } = await wlQuery

    for (const item of (waitlistItems || []) as WaitlistEntry[]) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      const message = `Merhaba ${item.customer_name}! 😊 Beklediğiniz randevu slotu uygun oldu. Hemen almak için: ${appUrl}/book/${apt.business_id}`

      const smsResult = await sendSMS({
        to: item.customer_phone,
        body: message,
        businessId: apt.business_id,
        customerId: item.customer_id || undefined,
        messageType: 'system',
      })

      if (smsResult.success) {
        await supabase
          .from('waitlist_entries')
          .update({ is_notified: true })
          .eq('id', item.id)
        waitlistNotifs.sent++
      } else {
        waitlistNotifs.errors++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    reminders,
    reviewRequests,
    winback,
    noShowScoring,
    waitlistNotifs,
  })
}
