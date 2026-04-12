import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { generateWhatsAppMessage } from '@/lib/whatsapp/templates'
import { verifyCronAuth } from '@/lib/api/verify-cron'

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const supabase = createAdminClient()
  const now = new Date()
  const results = { sent24h: 0, sent2h: 0, confirmations: 0, noResponseHandled: 0, errors: 0 }

  // ── 24 saat sonrası: Onay SMS'i veya basit hatırlatma ──
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
    .is('deleted_at', null)

  for (const apt of appointments24h || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any
    const service = apt.services as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.reminder_24h) continue

    try {
      const date = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
      const time = apt.start_time?.substring(0, 5) || ''
      const confirmationEnabled = business.settings?.confirmation_sms_enabled

      const template = confirmationEnabled ? 'appointment_confirmation_request' : 'appointment_reminder'
      const body = generateWhatsAppMessage(template, {
        customerName: customer.name,
        businessName: business.name,
        date,
        time,
        serviceName: service?.name || '',
      })

      await sendMessage({
        to: customer.phone,
        body,
        businessId: business.id,
        customerId: customer.id,
        messageType: 'system',
        channel: 'auto',
      })

      const aptUpdate: Record<string, unknown> = { reminder_24h_sent: true }
      if (confirmationEnabled) {
        aptUpdate.confirmation_status = 'waiting'
        aptUpdate.confirmation_sent_at = new Date().toISOString()
        results.confirmations++
      }

      await supabase.from('appointments').update(aptUpdate).eq('id', apt.id)

      results.sent24h++
    } catch {
      results.errors++
    }
  }

  // ── 2 saat sonrası hatırlatma ──
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
      id, appointment_date, start_time, confirmation_status,
      customers(id, name, phone),
      services(name),
      businesses(id, name, settings)
    `)
    .eq('appointment_date', todayDate)
    .gte('start_time', windowStart)
    .lte('start_time', windowEndStr)
    .in('status', ['confirmed', 'pending'])
    .eq('reminder_2h_sent', false)
    .is('deleted_at', null)

  for (const apt of appointments2h || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any
    const service = apt.services as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.reminder_2h) continue

    try {
      // Eğer onay bekleniyordu ama cevap gelmediyse → no_response olarak işaretle
      if (apt.confirmation_status === 'waiting') {
        await supabase
          .from('appointments')
          .update({ confirmation_status: 'no_response' })
          .eq('id', apt.id)
        results.noResponseHandled++
      }

      const date = new Date(apt.appointment_date).toLocaleDateString('tr-TR', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
      const time = apt.start_time?.substring(0, 5) || ''

      const body = generateWhatsAppMessage('appointment_reminder', {
        customerName: customer.name,
        businessName: business.name,
        date,
        time,
        serviceName: service?.name || '',
      })

      await sendMessage({
        to: customer.phone,
        body,
        businessId: business.id,
        customerId: customer.id,
        messageType: 'system',
        channel: 'auto',
      })

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
