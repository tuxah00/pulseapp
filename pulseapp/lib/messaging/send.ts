// RLS bypass: cron/webhook bağlamlarından çağrılır, auth session olmayabilir; customer preferred_channel lookup için admin gerekli
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSMS } from '@/lib/sms/send'
import { sendWhatsApp } from '@/lib/whatsapp/send'
import { createLogger } from '@/lib/utils/logger'
import { isPilotMode } from '@/lib/pilot'
import type { BusinessSettings, MessageChannel, MessageType } from '@/types'

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

  // Pilot modu — Twilio/Meta entegrasyonları kapalı; mesaj 'web' kanalı olarak kaydedilir
  // ve personele in-app bildirim düşer. Belirli kanal istense bile pilot kazanır.
  if (await isBusinessInPilotMode(businessId)) {
    return savePilotPendingMessage({
      to,
      body,
      businessId,
      customerId,
      messageType,
      requestedChannel: channel === 'auto' ? null : channel,
      ...meta,
    })
  }

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

/**
 * İşletme settings'inden pilot_mode flag'ini okur. Hata durumunda false döner
 * (fail-open: pilot değilse normal akış devam eder).
 */
async function isBusinessInPilotMode(businessId: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data } = await admin
      .from('businesses')
      .select('settings')
      .eq('id', businessId)
      .single()
    return isPilotMode((data?.settings ?? null) as Pick<BusinessSettings, 'pilot_mode'> | null)
  } catch (err) {
    log.warn({ err, businessId }, 'Pilot mode okunamadı, normal akışa geçiliyor')
    return false
  }
}

/**
 * Pilot modunda mesaj — DB'ye 'web' kanalı olarak kaydet + personele bildirim düşür.
 * Personel bildirim panelinden mesajı görür ve manuel olarak (telefon/whatsapp) iletir.
 */
async function savePilotPendingMessage(params: {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType: MessageType
  requestedChannel: MessageChannel | null
  staffId?: string
  staffName?: string
  templateName?: string
  templateParams?: Record<string, string>
}): Promise<SendMessageResult> {
  const admin = createAdminClient()
  const { body, businessId, customerId, messageType, requestedChannel } = params

  // Müşteri adı (bildirim başlığı için) — bulunamazsa telefon numarasını kullan
  let customerName: string = params.to
  if (customerId) {
    const { data: customer } = await admin
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .maybeSingle()
    if (customer?.name) customerName = customer.name
  }

  await admin.from('messages').insert({
    business_id: businessId,
    customer_id: customerId || null,
    direction: 'outbound',
    channel: 'web',
    message_type: messageType,
    content: body,
    staff_id: params.staffId || null,
    staff_name: params.staffName || null,
    template_name: params.templateName || null,
    template_params: params.templateParams || null,
  })

  const channelLabel = requestedChannel === 'whatsapp' ? 'WhatsApp' : requestedChannel === 'sms' ? 'SMS' : 'Mesaj'
  const preview = body.length > 200 ? body.slice(0, 200) + '…' : body
  await admin.from('notifications').insert({
    business_id: businessId,
    type: 'pilot_message_pending',
    title: `${channelLabel} bekliyor (pilot): ${customerName} — ${params.to}`,
    body: preview,
    related_id: customerId || null,
    related_type: customerId ? 'customer' : null,
  })

  return { success: true, channel: 'web' }
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
