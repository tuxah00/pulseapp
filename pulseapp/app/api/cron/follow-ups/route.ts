import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { generateWhatsAppMessage } from '@/lib/whatsapp/templates'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/follow-ups' })

/**
 * Follow-up Cron Job
 *
 * follow_up_queue tablosundaki zamanı gelmiş (scheduled_for <= now) ve
 * status=pending olan kayıtları işler. Müşteriye SMS/WhatsApp gönderir.
 *
 * Çağrılma: GET /api/cron/follow-ups (CRON_SECRET ile korumalı)
 */
export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const supabase = createAdminClient()
  const now = new Date().toISOString()
  const results = { sent: 0, errors: 0, skipped: 0 }

  // Zamanı gelmiş bekleyen follow-up'ları al
  const { data: followUps, error } = await supabase
    .from('follow_up_queue')
    .select(`
      id, business_id, customer_id, appointment_id, protocol_id,
      type, message, scheduled_for,
      customer:customers(id, name, phone),
      appointment:appointments(
        id, appointment_date, start_time,
        service:services(name)
      ),
      business:businesses(id, name, settings)
    `)
    .eq('status', 'pending')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  for (const followUp of followUps || []) {
    const customer = followUp.customer as any
    const business = followUp.business as any
    const appointment = followUp.appointment as any

    // Telefon yoksa atla
    if (!customer?.phone || !business?.id) {
      await supabase
        .from('follow_up_queue')
        .update({ status: 'cancelled' })
        .eq('id', followUp.id)
      results.skipped++
      continue
    }

    try {
      // Özel mesaj varsa onu kullan, yoksa template'den oluştur
      const messageBody = followUp.message || generateWhatsAppMessage('follow_up', {
        customerName: customer.name,
        businessName: business.name,
        serviceName: appointment?.service?.name || '',
        message: '',
      })

      await sendMessage({
        to: customer.phone,
        body: messageBody,
        businessId: business.id,
        customerId: customer.id,
        messageType: 'system',
        channel: 'auto',
      })

      // Durumu sent olarak güncelle
      await supabase
        .from('follow_up_queue')
        .update({ status: 'sent' })
        .eq('id', followUp.id)

      results.sent++
    } catch (err) {
      log.error({ err, followUpId: followUp.id }, 'Follow-up gönderim hatası')
      // Hata durumunda cancelled olarak işaretle (tablo sadece pending/sent/cancelled destekliyor)
      await supabase
        .from('follow_up_queue')
        .update({ status: 'cancelled' })
        .eq('id', followUp.id)
      results.errors++
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
