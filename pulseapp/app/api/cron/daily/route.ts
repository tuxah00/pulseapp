import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendAppointmentReminder, sendWhatsAppMessage } from '@/lib/whatsapp/send'
import type { CustomerSegment } from '@/types'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
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

  for (const apt of appointments24h || []) {
    const customer = apt.customers as any
    const service = apt.services as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.reminder_24h) continue

    const result = await sendAppointmentReminder(
      business.id, customer.id, customer.phone, customer.name,
      business.name, service?.name || 'Randevu',
      apt.appointment_date, apt.start_time, '24h', apt.id,
    )

    if (result.success) {
      await supabase.from('appointments').update({ reminder_24h_sent: true }).eq('id', apt.id)
      reminders.sent24h++
    } else {
      reminders.errors++
    }
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

  for (const apt of appointments2h || []) {
    const customer = apt.customers as any
    const service = apt.services as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.reminder_2h) continue

    const result = await sendAppointmentReminder(
      business.id, customer.id, customer.phone, customer.name,
      business.name, service?.name || 'Randevu',
      apt.appointment_date, apt.start_time, '2h', apt.id,
    )

    if (result.success) {
      await supabase.from('appointments').update({ reminder_2h_sent: true }).eq('id', apt.id)
      reminders.sent2h++
    } else {
      reminders.errors++
    }
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

  for (const apt of completedApts || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.auto_review_request) continue

    const delayMinutes = business.settings.review_request_delay_minutes ?? 30
    const readyAt = new Date(new Date(apt.updated_at).getTime() + delayMinutes * 60 * 1000)
    if (readyAt > now) continue

    const googleLink = business.google_maps_url
    const message = googleLink
      ? `Merhaba ${customer.name}! 😊\n\n${business.name}'deki ziyaretiniz için teşekkür ederiz. Deneyiminizi paylaşır mısınız?\n\n⭐ Google'da yorum yapın:\n${googleLink}\n\nGörüşleriniz bizim için çok değerli! 🙏`
      : `Merhaba ${customer.name}! 😊\n\n${business.name}'deki ziyaretiniz için teşekkür ederiz. Hizmetimizden memnun kaldıysanız bizi tavsiye etmeyi unutmayın! 🙏`

    const result = await sendWhatsAppMessage({
      to: customer.phone, body: message,
      businessId: business.id, customerId: customer.id, messageType: 'system',
    })

    if (result.success) {
      await supabase.from('appointments').update({ review_requested: true }).eq('id', apt.id)
      reviewRequests.sent++
    } else {
      reviewRequests.errors++
    }
  }

  // ── 3. Winback + Segment Update ───────────────────────────────────────────
  const winback = { segmentsUpdated: 0, winbackSent: 0, errors: 0 }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  for (const business of businesses || []) {
    const winbackDays: number = business.settings?.winback_days ?? 60

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, total_visits, last_visit_at, segment, whatsapp_opted_in')
      .eq('business_id', business.id)
      .eq('is_active', true)

    for (const customer of customers || []) {
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

      const wasActive = customer.segment !== 'risk' && customer.segment !== 'lost'
      const nowRisk = newSegment === 'risk'

      try {
        await supabase.from('customers').update({ segment: newSegment }).eq('id', customer.id)
        winback.segmentsUpdated++

        if (wasActive && nowRisk && customer.whatsapp_opted_in && customer.phone) {
          const message = `Merhaba ${customer.name}! 💙\n\n${business.name} olarak sizi özledik! Bir süredir görüşememiştik.\n\nSizi tekrar ağırlamaktan mutluluk duyarız. Randevu almak için bize yazabilirsiniz. 😊`

          const result = await sendWhatsAppMessage({
            to: customer.phone, body: message,
            businessId: business.id, customerId: customer.id, messageType: 'system',
          })

          if (result.success) {
            winback.winbackSent++
          } else {
            winback.errors++
          }
        }
      } catch {
        winback.errors++
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    reminders,
    reviewRequests,
    winback,
  })
}
