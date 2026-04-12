import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/send'
import { sendMessage } from '@/lib/messaging/send'

/**
 * Twilio inbound SMS webhook
 * Twilio konsolunda SMS webhook URL'si olarak ayarlayın:
 * https://yourdomain.com/api/webhooks/sms
 */
export async function POST(request: NextRequest) {
  const body = await request.text()
  const params = new URLSearchParams(body)

  const from = params.get('From') || ''
  const to = params.get('To') || ''
  const messageBody = params.get('Body') || ''
  const messageSid = params.get('MessageSid') || ''

  if (!from || !messageBody) {
    return new NextResponse('OK', { status: 200 })
  }

  const admin = createAdminClient()

  // İşletmeyi Twilio numarasına göre bul
  const twilioNumber = process.env.TWILIO_PHONE_NUMBER || ''
  if (to !== twilioNumber && !twilioNumber.includes(to.replace('+', ''))) {
    // Numara eşleşmedi, yine de devam et (tek işletme için)
  }

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
    // Müşteri bulunamadı, ilk aktif işletmeye yaz
    const { data: firstBusiness } = await admin
      .from('businesses')
      .select('id')
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!firstBusiness) return new NextResponse('OK', { status: 200 })

    await admin.from('messages').insert({
      business_id: firstBusiness.id,
      customer_id: null,
      direction: 'inbound',
      channel: 'sms',
      message_type: 'text',
      content: messageBody,
      twilio_sid: messageSid,
      twilio_status: 'received',
    })

    return new NextResponse('OK', { status: 200 })
  }

  // Mesajı kaydet
  await admin.from('messages').insert({
    business_id: businessId,
    customer_id: customer?.id || null,
    direction: 'inbound',
    channel: 'sms',
    message_type: 'text',
    content: messageBody,
    twilio_sid: messageSid,
    twilio_status: 'received',
  })

  // ── Randevu Onay Kontrolü (EVET / HAYIR) ──
  const trimmed = messageBody.trim().toUpperCase()
  const isConfirm = /^(EVET|E|YES|1|ONAY|GEL[İI]YORUM|TAMAM|OK)$/i.test(trimmed)
  const isDecline = /^(HAYIR|H|NO|0|[İI]PTAL|GEL[Ee]M[İI]YORUM|VAZGE[CÇ])$/i.test(trimmed)

  if ((isConfirm || isDecline) && customer?.id) {
    const handled = await handleAppointmentConfirmation(admin, customer.id, businessId, isConfirm)
    if (handled) {
      return new NextResponse('OK', { status: 200 })
    }
  }

  // ── Otomatik Yanıt (mevcut sistem) ──
  const { data: business } = await admin
    .from('businesses')
    .select('name, phone, address, city, district, google_maps_url, working_hours, settings')
    .eq('id', businessId)
    .single()

  if (!business?.settings?.ai_auto_reply) {
    return new NextResponse('OK', { status: 200 })
  }

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
    await sendSMS({
      to: from,
      body: autoReply,
      businessId,
      customerId: customer.id,
      messageType: 'system',
    })
  }

  return new NextResponse('OK', { status: 200 })
}

/**
 * Müşterinin EVET/HAYIR yanıtını en yakın "waiting" randevusuyla eşleştir ve işle.
 */
async function handleAppointmentConfirmation(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string,
  businessId: string,
  isConfirm: boolean
): Promise<boolean> {
  // Müşterinin "waiting" durumundaki en yakın randevusunu bul
  const todayStr = new Date().toISOString().split('T')[0]

  const { data: waitingApts } = await admin
    .from('appointments')
    .select('id, appointment_date, start_time, businesses(name), services(name), customers(name, phone)')
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .eq('confirmation_status', 'waiting')
    .gte('appointment_date', todayStr)
    .in('status', ['confirmed', 'pending'])
    .is('deleted_at', null)
    .order('appointment_date', { ascending: true })
    .order('start_time', { ascending: true })
    .limit(1)

  const apt = waitingApts?.[0]
  if (!apt) return false

  const customer = apt.customers as any
  const business = apt.businesses as any

  if (isConfirm) {
    // Onay: confirmation_status → confirmed_by_customer, status → confirmed
    await admin
      .from('appointments')
      .update({
        confirmation_status: 'confirmed_by_customer',
        status: 'confirmed',
      })
      .eq('id', apt.id)

    // Müşteriye onay mesajı gönder
    if (customer?.phone) {
      await sendMessage({
        to: customer.phone,
        body: `Teşekkürler ${customer.name || ''} ✅ Randevunuz onaylandı. Sizi bekliyoruz!`,
        businessId,
        customerId,
        messageType: 'system',
        channel: 'auto',
      })
    }
  } else {
    // Red: confirmation_status → declined, status → cancelled
    await admin
      .from('appointments')
      .update({
        confirmation_status: 'declined',
        status: 'cancelled',
        cancellation_reason: 'Müşteri SMS ile iptal etti',
      })
      .eq('id', apt.id)

    // Müşteriye iptal mesajı gönder
    if (customer?.phone) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
      await sendMessage({
        to: customer.phone,
        body: `Randevunuz iptal edildi. Yeni randevu almak için: ${appUrl}/book/${businessId}`,
        businessId,
        customerId,
        messageType: 'system',
        channel: 'auto',
      })
    }
  }

  return true
}
