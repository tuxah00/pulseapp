import { createAdminClient } from '@/lib/supabase/admin'
import { decrypt } from '@/lib/whatsapp/crypto'
import { sendTextMessage, sendTemplateMessage } from '@/lib/whatsapp/meta-client'
import type { MessageType } from '@/types'

interface SendMessageOptions {
  to: string
  body: string
  businessId: string
  customerId?: string
  messageType?: MessageType
  appointmentId?: string
  templateName?: string
  templateParams?: Array<{
    type: 'body' | 'header'
    parameters: Array<{ type: 'text'; text: string }>
  }>
}

interface SendResult {
  success: boolean
  messageId?: string
  error?: string
  channel: 'meta' | 'twilio_legacy' | 'none'
}

async function getMetaCredentials(businessId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('whatsapp_accounts')
    .select('phone_number_id, access_token_encrypted, status')
    .eq('business_id', businessId)
    .eq('status', 'active')
    .single()

  if (!data) return null

  try {
    const accessToken = decrypt(data.access_token_encrypted)
    return { phoneNumberId: data.phone_number_id, accessToken }
  } catch {
    console.error('WhatsApp token çözme hatası, businessId:', businessId)
    return null
  }
}

export async function sendWhatsAppMessage(options: SendMessageOptions): Promise<SendResult> {
  const {
    to, body, businessId, customerId,
    messageType = 'text', appointmentId,
    templateName, templateParams,
  } = options

  const credentials = await getMetaCredentials(businessId)

  if (credentials) {
    return sendViaMeta(credentials, options)
  }

  return sendViaTwilioLegacy(options)
}

async function sendViaMeta(
  credentials: { phoneNumberId: string; accessToken: string },
  options: SendMessageOptions,
): Promise<SendResult> {
  const {
    to, body, businessId, customerId,
    messageType = 'text', appointmentId,
    templateName, templateParams,
  } = options

  try {
    let result

    if (templateName) {
      result = await sendTemplateMessage(
        credentials.phoneNumberId,
        credentials.accessToken,
        to,
        templateName,
        'tr',
        templateParams,
      )
    } else {
      result = await sendTextMessage(
        credentials.phoneNumberId,
        credentials.accessToken,
        to,
        body,
      )
    }

    if (!result.success) {
      return { success: false, error: result.error, channel: 'meta' }
    }

    const supabase = createAdminClient()
    await supabase.from('messages').insert({
      business_id: businessId,
      customer_id: customerId || null,
      direction: 'outbound',
      channel: 'whatsapp',
      message_type: messageType,
      content: body,
      meta_message_id: result.messageId || null,
      appointment_id: appointmentId || null,
    })

    return { success: true, messageId: result.messageId, channel: 'meta' }
  } catch (error: any) {
    console.error('Meta WhatsApp mesaj gönderme hatası:', error)
    return { success: false, error: error.message, channel: 'meta' }
  }
}

async function sendViaTwilioLegacy(options: SendMessageOptions): Promise<SendResult> {
  const {
    to, body, businessId, customerId,
    messageType = 'text', appointmentId,
  } = options

  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER

    if (
      !accountSid || !authToken || !whatsappNumber ||
      accountSid.startsWith('AC...')
    ) {
      return { success: false, error: 'WhatsApp hesabı bağlı değil ve Twilio yapılandırılmamış.', channel: 'none' }
    }

    const { formatWhatsAppNumber, getTwilioClient, getWhatsAppNumber } = await import('./client')

    const client = getTwilioClient()
    const from = getWhatsAppNumber()
    const toFormatted = formatWhatsAppNumber(to)

    const twilioMessage = await client.messages.create({ from, to: toFormatted, body })

    const supabase = createAdminClient()
    await supabase.from('messages').insert({
      business_id: businessId,
      customer_id: customerId || null,
      direction: 'outbound',
      channel: 'whatsapp',
      message_type: messageType,
      content: body,
      twilio_sid: twilioMessage.sid,
      twilio_status: twilioMessage.status,
      appointment_id: appointmentId || null,
    })

    return { success: true, messageId: twilioMessage.sid, channel: 'twilio_legacy' }
  } catch (error: any) {
    console.error('Twilio (legacy) mesaj gönderme hatası:', error)
    return { success: false, error: error.message, channel: 'twilio_legacy' }
  }
}

export async function sendAppointmentReminder(
  businessId: string,
  customerId: string,
  customerPhone: string,
  customerName: string,
  businessName: string,
  serviceName: string,
  appointmentDate: string,
  startTime: string,
  reminderType: '24h' | '2h',
  appointmentId: string,
): Promise<SendResult> {
  const timeLabel = reminderType === '24h' ? 'yarın' : '2 saat sonra'
  const formattedTime = startTime.slice(0, 5)

  const body = reminderType === '24h'
    ? `Merhaba ${customerName} 👋\n\n${businessName} randevunuzu hatırlatmak isteriz:\n📅 ${timeLabel}, saat ${formattedTime}\n💈 ${serviceName}\n\nGörüşmek üzere! Değişiklik için bize yazabilirsiniz.`
    : `Merhaba ${customerName} 👋\n\n${businessName} randevunuz ${timeLabel}ra, saat ${formattedTime}'de!\n💈 ${serviceName}\n\nSizi bekliyoruz! 😊`

  return sendWhatsAppMessage({
    to: customerPhone,
    body,
    businessId,
    customerId,
    messageType: 'template',
    appointmentId,
  })
}
