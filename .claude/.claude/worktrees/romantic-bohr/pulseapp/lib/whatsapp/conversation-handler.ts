import { createAdminClient } from '@/lib/supabase/admin'
import { getAnthropicClient, AI_MODEL, MAX_TOKENS } from '@/lib/ai/client'
import { getClassifySystemPrompt, getSmartReplySystemPrompt } from '@/lib/ai/prompts'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'
import type {
  AiClassification,
  ConversationState,
  WorkingHours,
  SectorType,
} from '@/types'
import type { SmartReplyContext } from '@/lib/ai/prompts'

const VALID_CLASSIFICATIONS: AiClassification[] = [
  'appointment', 'question', 'complaint', 'cancellation', 'greeting', 'other',
]

const DAY_LABELS: Record<string, string> = {
  mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz',
}

const CONVERSATION_TIMEOUT_MS = 30 * 60 * 1000 // 30 min

interface HandleConversationParams {
  businessId: string
  customerId: string
  customerName: string
  customerPhone: string
  messageBody: string
  inboundMessageId: string | null
  business: {
    name: string
    sector: SectorType
    settings: any
    working_hours: WorkingHours | null
    address?: string | null
    google_maps_url?: string | null
  }
}

interface SmartReplyResult {
  reply: string
  action: string
  appointmentId: string | null
  extractedDate: string | null
  extractedTime: string | null
}

export async function handleConversation(params: HandleConversationParams): Promise<{
  replied: boolean
  classification: AiClassification
  confidence: number
  summary: string
}> {
  const {
    businessId, customerId, customerName, customerPhone,
    messageBody, inboundMessageId, business,
  } = params

  const supabase = createAdminClient()

  let classification: AiClassification = 'other'
  let confidence = 0.5
  let summary = ''

  try {
    const aiClient = getAnthropicClient()
    const classifyPrompt = getClassifySystemPrompt(business.sector, business.name)

    const classifyRes = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: 256,
      system: classifyPrompt,
      messages: [{ role: 'user', content: messageBody }],
    })

    const classifyText = classifyRes.content[0].type === 'text' ? classifyRes.content[0].text : ''
    const parsed = JSON.parse(classifyText)
    classification = VALID_CLASSIFICATIONS.includes(parsed.classification)
      ? parsed.classification
      : 'other'
    confidence = Math.max(0, Math.min(1, parsed.confidence || 0.5))
    summary = parsed.summary || ''
  } catch (err) {
    console.error('AI sınıflandırma hatası:', err)
  }

  if (inboundMessageId) {
    await supabase
      .from('messages')
      .update({ ai_classification: classification, ai_confidence: confidence })
      .eq('id', inboundMessageId)
  }

  const settings = (business.settings || {}) as any
  if (settings.ai_auto_reply !== true) {
    return { replied: false, classification, confidence, summary }
  }

  const conversation = await getOrCreateConversation(businessId, customerPhone, customerId)

  const isTimedOut = conversation.last_message_at &&
    Date.now() - new Date(conversation.last_message_at).getTime() > CONVERSATION_TIMEOUT_MS

  let currentState: ConversationState = conversation.state as ConversationState
  let currentContext = conversation.context || {}

  if (isTimedOut && currentState !== 'idle') {
    currentState = 'idle'
    currentContext = {}
    await updateConversation(conversation.id, 'idle', {})
  }

  const { data: services } = await supabase
    .from('services')
    .select('name, duration_minutes, price')
    .eq('business_id', businessId)
    .eq('is_active', true)

  const serviceNames = (services || []).map(
    (s: any) => `${s.name} (${s.duration_minutes} dk${s.price ? `, ${s.price} TL` : ''})`,
  )

  const wh = (business.working_hours || {}) as WorkingHours
  const whText = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const)
    .map(d => wh[d] ? `${DAY_LABELS[d]}: ${wh[d]!.open}-${wh[d]!.close}` : `${DAY_LABELS[d]}: Kapalı`)
    .join(', ')

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, appointment_date, start_time, status, service:services(name)')
    .eq('customer_id', customerId)
    .eq('business_id', businessId)
    .in('status', ['pending', 'confirmed'])
    .gte('appointment_date', new Date().toISOString().split('T')[0])
    .order('appointment_date', { ascending: true })
    .limit(5)

  const upcomingAppointments = (appointments || []).map((a: any) => ({
    id: a.id,
    date: a.appointment_date,
    time: a.start_time?.slice(0, 5) || '',
    serviceName: a.service?.name || 'Belirtilmemiş',
    status: a.status,
  }))

  const smartCtx: SmartReplyContext = {
    businessName: business.name,
    sector: business.sector,
    services: serviceNames,
    workingHoursText: whText,
    address: business.address || null,
    googleMapsUrl: business.google_maps_url || null,
    customerName,
    upcomingAppointments,
    conversationState: currentState,
    conversationContext: currentContext,
  }

  let smartReply: SmartReplyResult | null = null

  try {
    const aiClient = getAnthropicClient()
    const systemPrompt = getSmartReplySystemPrompt(smartCtx)
    const userContent = `Müşteri mesajı: "${messageBody}"`

    const res = await aiClient.messages.create({
      model: AI_MODEL,
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    })

    const text = res.content[0].type === 'text' ? res.content[0].text.trim() : ''
    smartReply = parseSmartReply(text)
  } catch (err) {
    console.error('Smart reply AI hatası:', err)
  }

  if (!smartReply) {
    return { replied: false, classification, confidence, summary }
  }

  await executeAction(
    smartReply,
    conversation.id,
    currentState,
    businessId,
    customerId,
    customerPhone,
    upcomingAppointments,
    business.working_hours,
  )

  if (smartReply.reply) {
    await sendWhatsAppMessage({
      to: customerPhone,
      body: smartReply.reply,
      businessId,
      customerId,
      messageType: 'ai_generated',
    })
    return { replied: true, classification, confidence, summary }
  }

  return { replied: false, classification, confidence, summary }
}


async function getOrCreateConversation(
  businessId: string,
  customerPhone: string,
  customerId: string,
) {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('whatsapp_conversations')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_phone', customerPhone)
    .single()

  if (existing) {
    await supabase
      .from('whatsapp_conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', existing.id)
    return existing
  }

  const { data: created } = await supabase
    .from('whatsapp_conversations')
    .insert({
      business_id: businessId,
      customer_phone: customerPhone,
      customer_id: customerId,
      state: 'idle',
      context: {},
    })
    .select('*')
    .single()

  return created!
}


async function updateConversation(
  conversationId: string,
  state: ConversationState,
  context: Record<string, any>,
) {
  const supabase = createAdminClient()
  await supabase
    .from('whatsapp_conversations')
    .update({
      state,
      context,
      updated_at: new Date().toISOString(),
    })
    .eq('id', conversationId)
}


function parseSmartReply(text: string): SmartReplyResult | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    const parsed = JSON.parse(jsonMatch[0])
    return {
      reply: parsed.reply || '',
      action: parsed.action || 'none',
      appointmentId: parsed.appointmentId || null,
      extractedDate: parsed.extractedDate || null,
      extractedTime: parsed.extractedTime || null,
    }
  } catch {
    return { reply: text, action: 'none', appointmentId: null, extractedDate: null, extractedTime: null }
  }
}


async function executeAction(
  smartReply: SmartReplyResult,
  conversationId: string,
  currentState: ConversationState,
  businessId: string,
  customerId: string,
  customerPhone: string,
  upcomingAppointments: Array<{ id: string; date: string; time: string; serviceName: string; status: string }>,
  workingHours: WorkingHours | null,
) {
  const supabase = createAdminClient()
  const { action, appointmentId, extractedDate, extractedTime } = smartReply

  switch (action) {
    case 'start_reschedule': {
      const apptId = appointmentId || upcomingAppointments[0]?.id
      const svcName = upcomingAppointments.find(a => a.id === apptId)?.serviceName || ''
      if (apptId) {
        await updateConversation(conversationId, 'awaiting_reschedule_date', {
          appointment_id: apptId,
          service_name: svcName,
        })
      }
      break
    }

    case 'confirm_reschedule': {
      if (currentState === 'awaiting_reschedule_date' && extractedDate && extractedTime) {
        const ctx = await getConversationContext(conversationId)
        await updateConversation(conversationId, 'awaiting_reschedule_confirm', {
          ...ctx,
          proposed_date: extractedDate,
          proposed_time: extractedTime,
        })
      } else if (currentState === 'awaiting_reschedule_confirm') {
        const ctx = await getConversationContext(conversationId)
        const apptId = ctx.appointment_id
        const date = extractedDate || ctx.proposed_date
        const time = extractedTime || ctx.proposed_time

        if (apptId && date && time) {
          const endTime = calculateEndTime(time, 60)

          await supabase
            .from('appointments')
            .update({
              appointment_date: date,
              start_time: time,
              end_time: endTime,
              updated_at: new Date().toISOString(),
            })
            .eq('id', apptId)
            .eq('business_id', businessId)

          await updateConversation(conversationId, 'idle', {})

          await supabase.from('notifications').insert({
            business_id: businessId,
            type: 'appointment',
            title: 'Randevu ertelendi (WhatsApp)',
            body: `Müşteri randevusunu ${date} ${time} tarihine erteledi.`,
            related_id: apptId,
            related_type: 'appointment',
          })
        }
      }
      break
    }

    case 'start_cancel': {
      const apptId = appointmentId || upcomingAppointments[0]?.id
      if (apptId) {
        await updateConversation(conversationId, 'awaiting_cancel_confirm', {
          appointment_id: apptId,
          service_name: upcomingAppointments.find(a => a.id === apptId)?.serviceName || '',
        })
      }
      break
    }

    case 'confirm_cancel': {
      const ctx = await getConversationContext(conversationId)
      const apptId = ctx.appointment_id || appointmentId

      if (apptId) {
        await supabase
          .from('appointments')
          .update({
            status: 'cancelled',
            cancellation_reason: 'WhatsApp üzerinden müşteri tarafından iptal edildi',
            updated_at: new Date().toISOString(),
          })
          .eq('id', apptId)
          .eq('business_id', businessId)

        await updateConversation(conversationId, 'idle', {})

        await supabase.from('notifications').insert({
          business_id: businessId,
          type: 'appointment',
          title: 'Randevu iptal edildi (WhatsApp)',
          body: `Müşteri randevusunu WhatsApp üzerinden iptal etti.`,
          related_id: apptId,
          related_type: 'appointment',
        })
      }
      break
    }

    case 'show_hours':
    case 'show_address':
    case 'show_services':
    case 'none':
    default:
      if (currentState !== 'idle' && action === 'none') {
        await updateConversation(conversationId, 'idle', {})
      }
      break
  }
}


async function getConversationContext(conversationId: string): Promise<Record<string, any>> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('whatsapp_conversations')
    .select('context')
    .eq('id', conversationId)
    .single()
  return (data?.context as Record<string, any>) || {}
}


function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours, minutes] = startTime.split(':').map(Number)
  const totalMinutes = hours * 60 + minutes + durationMinutes
  const endHours = Math.floor(totalMinutes / 60) % 24
  const endMinutes = totalMinutes % 60
  return `${String(endHours).padStart(2, '0')}:${String(endMinutes).padStart(2, '0')}`
}
