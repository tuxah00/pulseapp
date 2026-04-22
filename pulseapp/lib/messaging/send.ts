import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/send'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { createLogger } from '@/lib/utils/logger'
import type { MessageChannel, MessageType } from '@/types'

const log = createLogger({ module: 'messaging/send' })

interface SendMessageParams {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType?: MessageType
  /** 'auto' otomatik kanal seçimi yapar, yoksa belirtilen kanalı kullanır */
  channel?: MessageChannel | 'auto'
  mediaUrl?: string
  staffId?: string
  staffName?: string
  templateName?: string
  templateParams?: Record<string, string>
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
    staffId,
    staffName,
    templateName,
    templateParams,
  } = params

  // Tüm kanallara geçilen ortak metadata
  const meta = { staffId, staffName, templateName, templateParams }

  // Belirli kanal isteniyorsa doğrudan gönder
  if (channel === 'whatsapp') {
    const result = await sendWhatsApp({ to, body, businessId, customerId, messageType, mediaUrl, ...meta })
    return { ...result, channel: 'whatsapp' }
  }

  if (channel === 'sms') {
    const result = await sendSMS({ to, body, businessId, customerId, messageType, ...meta })
    return { ...result, channel: 'sms' }
  }

  if (channel === 'web') {
    return saveAsWebMessage({ body, businessId, customerId, messageType, ...meta })
  }

  // auto kanal seçimi
  const resolvedChannel = await resolveChannel(businessId, customerId)

  if (resolvedChannel === 'whatsapp') {
    const result = await sendWhatsApp({ to, body, businessId, customerId, messageType, mediaUrl, ...meta })
    if (result.success) return { ...result, channel: 'whatsapp' }
    // WhatsApp başarısız olursa SMS'e fallback
    log.warn({ businessId, error: result.error }, 'WhatsApp başarısız, SMS fallback deneniyor')
    const smsResult = await sendSMS({ to, body, businessId, customerId, messageType, ...meta })
    return { ...smsResult, channel: 'sms' }
  }

  if (resolvedChannel === 'sms') {
    const result = await sendSMS({ to, body, businessId, customerId, messageType, ...meta })
    if (result.success) return { ...result, channel: 'sms' }
    // SMS başarısız olursa web'e kaydet
    return saveAsWebMessage({ body, businessId, customerId, messageType, ...meta })
  }

  // Hiçbir kanal yapılandırılmamış
  return saveAsWebMessage({ body, businessId, customerId, messageType, ...meta })
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
      .eq('is_active', true)
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
  messageType: MessageType
  staffId?: string
  staffName?: string
  templateName?: string
  templateParams?: Record<string, string>
}): Promise<SendMessageResult> {
  const admin = createAdminClient()
  await admin.from('messages').insert({
    business_id: params.businessId,
    customer_id: params.customerId || null,
    direction: 'outbound',
    channel: 'web',
    message_type: params.messageType,
    content: params.body,
    staff_id: params.staffId || null,
    staff_name: params.staffName || null,
    template_name: params.templateName || null,
    template_params: params.templateParams || null,
  })
  return { success: true, channel: 'web' }
}
