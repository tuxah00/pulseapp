// Tek işletme için otomasyon çalıştırıcıları.
// Pilot modunda Vercel Cron yok — bu modülü dashboard'daki "Şimdi çalıştır" butonu çağırır.
// Cron route'larıyla aynı iş mantığını taşır ama tek bir businessId'ye scope'lanır.

import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { generateWhatsAppMessage } from '@/lib/whatsapp/templates'
import { isBirthdayToday } from '@/lib/utils/birthday'
import { createLogger } from '@/lib/utils/logger'
import type { CustomerSegment } from '@/types'

const log = createLogger({ module: 'automations/run' })

export type AutomationJobType = 'reminders' | 'birthday' | 'review_requests' | 'winback'

export interface AutomationRunResult {
  jobType: AutomationJobType
  success: boolean
  durationMs: number
  result: Record<string, number>
  error?: string
}

// ─── Reminders (24h + 2h) ───────────────────────────────────────────────────
async function runReminders(businessId: string): Promise<Record<string, number>> {
  const admin = createAdminClient()
  const now = new Date()
  const counts = { sent24h: 0, sent2h: 0, confirmations: 0, skipped: 0, errors: 0 }

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, settings')
    .eq('id', businessId)
    .single()

  if (!business) return counts

  const settings = business.settings as Record<string, unknown> | null

  // 24 saat sonrası
  if (settings?.reminder_24h) {
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    const tomorrowDate = tomorrow.toISOString().split('T')[0]

    const { data: appointments } = await admin
      .from('appointments')
      .select('id, appointment_date, start_time, customers(id, name, phone), services(name)')
      .eq('business_id', businessId)
      .eq('appointment_date', tomorrowDate)
      .in('status', ['confirmed', 'pending'])
      .eq('reminder_24h_sent', false)
      .is('deleted_at', null)

    const confirmationEnabled = settings?.confirmation_sms_enabled === true
    for (const apt of appointments || []) {
      const customer = apt.customers as unknown as { id: string; name: string; phone: string } | null
      const service = apt.services as unknown as { name: string } | null
      if (!customer?.phone) { counts.skipped++; continue }
      try {
        const date = new Date(apt.appointment_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
        const time = apt.start_time?.substring(0, 5) || ''
        const template = confirmationEnabled ? 'appointment_confirmation_request' : 'appointment_reminder'
        const body = generateWhatsAppMessage(template, {
          customerName: customer.name,
          businessName: business.name,
          date,
          time,
          serviceName: service?.name || '',
        })
        await sendMessage({ to: customer.phone, body, businessId, customerId: customer.id, messageType: 'system', channel: 'auto' })
        const update: Record<string, unknown> = { reminder_24h_sent: true }
        if (confirmationEnabled) {
          update.confirmation_status = 'waiting'
          update.confirmation_sent_at = new Date().toISOString()
          counts.confirmations++
        }
        await admin.from('appointments').update(update).eq('id', apt.id)
        counts.sent24h++
      } catch (err) {
        log.error({ err, aptId: apt.id }, '24h hatırlatma hatası')
        counts.errors++
      }
    }
  }

  // 2 saat sonrası
  if (settings?.reminder_2h) {
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const todayDate = now.toISOString().split('T')[0]
    const startH = String(twoHoursLater.getHours()).padStart(2, '0')
    const startM = String(twoHoursLater.getMinutes()).padStart(2, '0')
    const windowStart = `${startH}:${startM}:00`
    const windowEndDate = new Date(twoHoursLater.getTime() + 60 * 60 * 1000) // 1 saat genişlet (manuel tetik için tolerans)
    const endH = String(windowEndDate.getHours()).padStart(2, '0')
    const endM = String(windowEndDate.getMinutes()).padStart(2, '0')
    const windowEnd = `${endH}:${endM}:00`

    const { data: appointments } = await admin
      .from('appointments')
      .select('id, appointment_date, start_time, customers(id, name, phone), services(name)')
      .eq('business_id', businessId)
      .eq('appointment_date', todayDate)
      .gte('start_time', windowStart)
      .lte('start_time', windowEnd)
      .in('status', ['confirmed', 'pending'])
      .eq('reminder_2h_sent', false)
      .is('deleted_at', null)

    for (const apt of appointments || []) {
      const customer = apt.customers as unknown as { id: string; name: string; phone: string } | null
      const service = apt.services as unknown as { name: string } | null
      if (!customer?.phone) { counts.skipped++; continue }
      try {
        const date = new Date(apt.appointment_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
        const time = apt.start_time?.substring(0, 5) || ''
        const body = generateWhatsAppMessage('appointment_reminder', {
          customerName: customer.name,
          businessName: business.name,
          date,
          time,
          serviceName: service?.name || '',
        })
        await sendMessage({ to: customer.phone, body, businessId, customerId: customer.id, messageType: 'system', channel: 'auto' })
        await admin.from('appointments').update({ reminder_2h_sent: true }).eq('id', apt.id)
        counts.sent2h++
      } catch (err) {
        log.error({ err, aptId: apt.id }, '2h hatırlatma hatası')
        counts.errors++
      }
    }
  }

  return counts
}

// ─── Birthday ───────────────────────────────────────────────────────────────
async function runBirthday(businessId: string): Promise<Record<string, number>> {
  const admin = createAdminClient()
  const counts = { sent: 0, skipped: 0, errors: 0 }

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, settings')
    .eq('id', businessId)
    .single()
  if (!business) return counts

  const settings = (business.settings || {}) as Record<string, unknown>
  if (!settings.birthday_sms_enabled) return counts

  const trDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const todayStart = new Date(trDate.getFullYear(), trDate.getMonth(), trDate.getDate()).toISOString()

  const { data: customers } = await admin
    .from('customers')
    .select('id, name, phone, birthday')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('birthday', 'is', null)

  for (const c of customers || []) {
    if (!c.birthday || !c.phone) { counts.skipped++; continue }
    if (!isBirthdayToday(c.birthday, trDate)) { counts.skipped++; continue }

    // Bugün zaten gönderildi mi (idempotency)
    const { count } = await admin
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', c.id)
      .eq('template_name', 'birthday_greeting')
      .gte('created_at', todayStart)
    if ((count || 0) > 0) { counts.skipped++; continue }

    const template = (settings.birthday_sms_template as string) || 'Mutlu yıllar {customerName}! {businessName} ailesi olarak doğum gününüzü kutlarız 🎉'
    const body = template
      .replace(/\{customerName\}/g, c.name || '')
      .replace(/\{businessName\}/g, business.name || '')

    try {
      await sendMessage({
        to: c.phone,
        body,
        businessId,
        customerId: c.id,
        messageType: 'system',
        channel: 'auto',
        templateName: 'birthday_greeting',
      })
      counts.sent++
    } catch (err) {
      log.error({ err, customerId: c.id }, 'Doğum günü mesajı hatası')
      counts.errors++
    }
  }

  return counts
}

// ─── Review requests ────────────────────────────────────────────────────────
async function runReviewRequests(businessId: string): Promise<Record<string, number>> {
  const admin = createAdminClient()
  const counts = { sent: 0, skipped: 0, errors: 0 }

  const { data: business } = await admin
    .from('businesses')
    .select('id, name, settings')
    .eq('id', businessId)
    .single()
  if (!business) return counts

  const settings = (business.settings || {}) as Record<string, unknown>
  if (!settings.auto_review_request) return counts

  const delayMinutes = (settings.review_request_delay_minutes as number | undefined) ?? 60
  const cutoff = new Date(Date.now() - delayMinutes * 60 * 1000)

  const { data: appointments } = await admin
    .from('appointments')
    .select('id, customers(id, name, phone)')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .eq('review_request_sent', false)
    .lte('updated_at', cutoff.toISOString())
    .is('deleted_at', null)

  for (const apt of appointments || []) {
    const customer = apt.customers as unknown as { id: string; name: string; phone: string } | null
    if (!customer?.phone) { counts.skipped++; continue }
    try {
      const body = `${customer.name}, ${business.name} hizmetinden memnun kaldıysanız bir Google yorumu çok değerli olur. Teşekkürler!`
      await sendMessage({ to: customer.phone, body, businessId, customerId: customer.id, messageType: 'system', channel: 'auto', templateName: 'review_request' })
      await admin.from('appointments').update({ review_request_sent: true }).eq('id', apt.id)
      counts.sent++
    } catch (err) {
      log.error({ err, aptId: apt.id }, 'Yorum isteği hatası')
      counts.errors++
    }
  }

  return counts
}

// ─── Winback (segment refresh) ──────────────────────────────────────────────
async function runWinback(businessId: string): Promise<Record<string, number>> {
  const admin = createAdminClient()
  const counts = { segmentsUpdated: 0, errors: 0 }

  const { data: business } = await admin
    .from('businesses')
    .select('id, settings')
    .eq('id', businessId)
    .single()
  if (!business) return counts

  const winbackDays = (business.settings as Record<string, unknown> | null)?.winback_days as number | undefined ?? 60
  const now = new Date()

  const { data: customers } = await admin
    .from('customers')
    .select('id, total_visits, last_visit_at, segment')
    .eq('business_id', businessId)
    .eq('is_active', true)

  for (const c of customers || []) {
    const visits = c.total_visits ?? 0
    const lastVisit = c.last_visit_at ? new Date(c.last_visit_at) : null
    let newSegment: CustomerSegment = visits === 0 ? 'new' : visits < 5 ? 'regular' : 'vip'
    if (lastVisit) {
      const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      if (daysSince >= winbackDays * 2) newSegment = 'lost'
      else if (daysSince >= winbackDays) newSegment = 'risk'
    }
    if (newSegment === c.segment) continue
    try {
      await admin.from('customers').update({ segment: newSegment }).eq('id', c.id)
      counts.segmentsUpdated++
    } catch (err) {
      log.error({ err, customerId: c.id }, 'Segment güncelleme hatası')
      counts.errors++
    }
  }

  return counts
}

// ─── Public dispatcher ──────────────────────────────────────────────────────
export async function runAutomation(
  jobType: AutomationJobType,
  businessId: string,
  triggeredBy: 'cron' | 'manual',
  triggeredUserId?: string
): Promise<AutomationRunResult> {
  const start = Date.now()
  let result: Record<string, number> = {}
  let success = true
  let error: string | undefined

  try {
    switch (jobType) {
      case 'reminders': result = await runReminders(businessId); break
      case 'birthday': result = await runBirthday(businessId); break
      case 'review_requests': result = await runReviewRequests(businessId); break
      case 'winback': result = await runWinback(businessId); break
    }
  } catch (err) {
    success = false
    error = err instanceof Error ? err.message : String(err)
    log.error({ err, jobType, businessId }, 'Otomasyon hatası')
  }

  const durationMs = Date.now() - start

  // Log
  try {
    const admin = createAdminClient()
    await admin.from('automations_log').insert({
      business_id: businessId,
      job_type: jobType,
      triggered_by: triggeredBy,
      triggered_user_id: triggeredUserId || null,
      result,
      duration_ms: durationMs,
      error: error || null,
    })
  } catch (err) {
    log.warn({ err }, 'automations_log yazılamadı')
  }

  return { jobType, success, durationMs, result, error }
}
