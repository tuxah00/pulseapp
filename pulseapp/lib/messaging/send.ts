import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/send'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import type { MessageChannel } from '@/types'

interface SendMessageParams {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType?: 'text' | 'template' | 'ai_generated' | 'system'
  /** 'auto' otomatik kanal seçimi yapar, yoksa belirtilen kanalı kullanır */
  channel?: MessageChannel | 'auto'
  mediaUrl?: string
}

interface SendMessageResult {
  success: boolean
  channel: MessageChannel
  messageSid?: string
  error?: string
}

/**
 * Birleşik mesaj gönderim fonksiyonu.
 *
 * Kanal seçimi mantığı (channel = 'auto'):
 * 1. Müşterinin preferred_channel veya whatsapp_opted_in durumuna bak
 * 2. İşletmenin WhatsApp yapılandırması var mı kontrol et
 * 3. WhatsApp mümkünse WhatsApp, değilse SMS gönder
 * 4. İkisi de yoksa web kanalına kaydet (gönderim yapılmaz)
 */
export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const {
    to,
    body,
    businessId,
    customerId,
    messageType = 'text',
    channel = 'auto',
    mediaUrl,
  } = params

  // Belirli kanal isteniyorsa doğrudan gönder
  if (channel === 'whatsapp') {
    const result = await sendWhatsApp({ to, body, businessId, customerId, messageType, mediaUrl })
    return { ...result, channel: 'whatsapp' }
  }

  if (channel === 'sms') {
    const result = await sendSMS({ to, body, businessId, customerId, messageType })
    return { ...result, channel: 'sms' }
  }

  if (channel === 'web') {
    return saveAsWebMessage({ body, businessId, customerId, messageType })
  }

  // auto kanal seçimi
  const resolvedChannel = await resolveChannel(businessId, customerId)

  if (resolvedChannel === 'whatsapp') {
    const result = await sendWhatsApp({ to, body, businessId, customerId, messageType, mediaUrl })
    if (result.success) return { ...result, channel: 'whatsapp' }
    // WhatsApp başarısız olursa SMS'e fallback
    console.warn('WhatsApp başarısız, SMS fallback deneniyor')
    const smsResult = await sendSMS({ to, body, businessId, customerId, messageType })
    return { ...smsResult, channel: 'sms' }
  }

  if (resolvedChannel === 'sms') {
    const result = await sendSMS({ to, body, businessId, customerId, messageType })
    if (result.success) return { ...result, channel: 'sms' }
    // SMS başarısız olursa web'e kaydet
    return saveAsWebMessage({ body, businessId, customerId, messageType })
  }

  // Hiçbir kanal yapılandırılmamış
  return saveAsWebMessage({ body, businessId, customerId, messageType })
}

/**
 * Müşteri ve işletme bilgilerine göre en uygun kanalı belirler.
 */
async function resolveChannel(
  businessId: string,
  customerId?: string
): Promise<MessageChannel> {
  const admin = createAdminClient()

  // WhatsApp yapılandırması kontrol et
  const hasWhatsApp = !!process.env.TWILIO_WHATSAPP_NUMBER

  if (!hasWhatsApp) return hasSMS() ? 'sms' : 'web'

  // Müşterinin kanal tercihini kontrol et
  if (customerId) {
    const { data: customer } = await admin
      .from('customers')
      .select('whatsapp_opted_in, preferred_channel')
      .eq('id', customerId)
      .single()

    if (customer?.preferred_channel === 'whatsapp' || customer?.whatsapp_opted_in) {
      return 'whatsapp'
    }

    if (customer?.preferred_channel === 'sms') {
      return 'sms'
    }
  }

  // Default: SMS (çoğu müşteri henüz WA opt-in yapmamış olacak)
  return hasSMS() ? 'sms' : 'whatsapp'
}

function hasSMS(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_PHONE_NUMBER
  )
}

/**
 * Mesajı sadece veritabanına kaydeder (gönderim yapılmaz).
 * SMS/WhatsApp yapılandırması yokken kullanılır.
 */
async function saveAsWebMessage(params: {
  body: string
  businessId: string
  customerId?: string
  messageType: string
}): Promise<SendMessageResult> {
  const admin = createAdminClient()
  await admin.from('messages').insert({
    business_id: params.businessId,
    customer_id: params.customerId || null,
    direction: 'outbound',
    channel: 'web',
    message_type: params.messageType,
    content: params.body,
  })
  return { success: true, channel: 'web' }
}
