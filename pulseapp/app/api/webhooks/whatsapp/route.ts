import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: harici webhook, kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { handleAppointmentConfirmationReply } from '@/lib/messaging/appointment-confirmation'
import { verifyTwilioWebhook } from '@/lib/webhooks/verify-twilio'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/webhooks/whatsapp' })

/**
 * Twilio WhatsApp inbound webhook
 * Twilio konsolunda WhatsApp webhook URL'si olarak ayarlayın:
 * https://yourdomain.com/api/webhooks/whatsapp
 *
 * Twilio, WhatsApp mesajlarını SMS ile aynı formatta gönderir,
 * fark: From/To alanları "whatsapp:+90..." formatındadır.
 */
export async function POST(request: NextRequest) {
  const body = await request.text()

  const webhookErr = verifyTwilioWebhook(request, body)
  if (webhookErr) return webhookErr

  const params = new URLSearchParams(body)

  // Twilio WA format: whatsapp:+905XXXXXXXXX
  const rawFrom = params.get('From') || ''
  const rawTo = params.get('To') || ''
  const messageBody = params.get('Body') || ''
  const messageSid = params.get('MessageSid') || ''
  const numMedia = parseInt(params.get('NumMedia') || '0', 10)
  const profileName = params.get('ProfileName') || ''

  // whatsapp: prefix'ini temizle
  const from = rawFrom.replace('whatsapp:', '')
  const to = rawTo.replace('whatsapp:', '')

  if (!from || !messageBody) {
    return new NextResponse('OK', { status: 200 })
  }

  const admin = createAdminClient()

  // Gönderenin telefon numarasına göre müşteriyi bul
  const normalizedFrom = from.replace(/\D/g, '')
  const { data: customers } = await admin
    .from('customers')
    .select('id, business_id, name')
    .or(`phone.eq.${from},phone.eq.+${normalizedFrom},phone.eq.0${normalizedFrom.slice(2)}`)
    .eq('is_active', true)
    .limit(1)

  const customer = customers?.[0]
  const businessId = customer?.business_id

  if (!businessId) {
    // Müşteri bulunamadı — orphan mesaj güvenlik riski (saldırgan ilk işletmeyi spam'leyebilir)
    // İşletmeye yazmak yerine sadece logla ve düş
    log.warn({ from, messageSid }, 'WhatsApp webhook: bilinmeyen numara, mesaj düşürüldü')
    return new NextResponse('OK', { status: 200 })
  }

  // Mesajı kaydet
  await admin.from('messages').insert({
    business_id: businessId,
    customer_id: customer?.id || null,
    direction: 'inbound',
    channel: 'whatsapp',
    message_type: 'text',
    content: messageBody,
    twilio_sid: messageSid,
    twilio_status: 'received',
    meta_message_id: messageSid,
  })

  // ── Randevu Onay Kontrolü (EVET / HAYIR) ──
  const trimmed = messageBody.trim().toUpperCase()
  const isConfirm = /^(EVET|E|YES|1|ONAY|GEL[İI]YORUM|TAMAM|OK)$/i.test(trimmed)
  const isDecline = /^(HAYIR|H|NO|0|[İI]PTAL|GEL[Ee]M[İI]YORUM|VAZGE[CÇ])$/i.test(trimmed)

  if ((isConfirm || isDecline) && customer?.id) {
    const handled = await handleAppointmentConfirmationReply(admin, customer.id, businessId, from, isConfirm, 'whatsapp')
    if (handled) return new NextResponse('OK', { status: 200 })
  }

  // İşletme ayarlarını çek
  const { data: business } = await admin
    .from('businesses')
    .select('name, phone, address, city, district, google_maps_url, working_hours, settings')
    .eq('id', businessId)
    .single()

  if (!business?.settings?.ai_auto_reply) {
    return new NextResponse('OK', { status: 200 })
  }

  // Otomatik yanıt: basit keyword eşleştirme
  const lowerBody = messageBody.toLowerCase()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const bookingLink = `${appUrl}/book/${businessId}`

  let autoReply: string | null = null

  if (/adres|nerede|konum|neredesiniz|maps|harita/.test(lowerBody)) {
    if (business.google_maps_url) {
      autoReply = `Merhaba! ${business.name} adresimiz: ${business.address}, ${business.district}/${business.city}\n📍 Google Maps: ${business.google_maps_url}`
    } else if (business.address) {
      autoReply = `Merhaba! ${business.name} adresimiz: ${business.address}, ${business.district}/${business.city}`
    }
  } else if (/randevu|almak istiyorum|rezervasyon|booking/.test(lowerBody)) {
    autoReply = `Merhaba! Online randevu almak için:\n🔗 ${bookingLink}\n\nYardım için bizi arayabilirsiniz: ${business.phone || ''}`
  } else if (/saat|kaçta|çalışma saatleri|açık mısınız|kaçta açılıyor/.test(lowerBody)) {
    const wh = business.working_hours as any
    const days: Record<string, string> = {
      mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz',
    }
    const hoursText = Object.entries(days)
      .map(([key, label]) => {
        const h = wh?.[key]
        return h ? `${label}: ${h.open}-${h.close}` : `${label}: Kapalı`
      })
      .join(', ')
    autoReply = `Merhaba! ${business.name} çalışma saatlerimiz:\n${hoursText}`
  }

  if (autoReply && customer?.id) {
    await sendWhatsApp({
      to: from,
      body: autoReply,
      businessId,
      customerId: customer.id,
      messageType: 'system',
    })
  }

  return new NextResponse('OK', { status: 200 })
}

