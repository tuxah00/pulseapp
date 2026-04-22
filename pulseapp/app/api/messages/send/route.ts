import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/messaging/send'
import { withPermission } from '@/lib/api/with-permission'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { messageSendSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/messages/send' })

export const POST = withPermission('messages', async (req: NextRequest, ctx) => {
  const rl = checkRateLimit(req, RATE_LIMITS.messaging)
  if (rl.limited) return rl.response

  const parsed = await validateBody(req, messageSendSchema)
  if (!parsed.ok) return parsed.response
  const {
    customerId,
    content,
    messageType = 'text',
    channel = 'auto',
    templateName,
    templateParams,
  } = parsed.data

  try {
    const supabase = createServerSupabaseClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id, phone, name, whatsapp_opted_in, preferred_channel')
      .eq('id', customerId)
      .eq('business_id', ctx.businessId)
      .eq('is_active', true)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }

    // Telefonu olan müşteriler için SMS/WhatsApp kanalı
    if (customer.phone) {
      const result = await sendMessage({
        to: customer.phone,
        body: content,
        businessId: ctx.businessId,
        customerId,
        messageType,
        channel,
        staffId: ctx.staffId,
        staffName: ctx.staffName,
        templateName,
        templateParams,
      })

      return NextResponse.json({
        success: result.success,
        channel: result.channel,
        messageSid: result.messageSid,
        error: result.error,
      })
    }

    // Telefon yoksa web kanalına kaydet
    const { error: dbError } = await supabase.from('messages').insert({
      business_id: ctx.businessId,
      customer_id: customerId,
      direction: 'outbound',
      channel: 'web',
      message_type: messageType,
      content,
      staff_id: ctx.staffId,
      staff_name: ctx.staffName,
      template_name: templateName ?? null,
      template_params: templateParams ?? null,
    })

    if (dbError) {
      log.error({ err: dbError, businessId: ctx.businessId }, 'Mesaj DB kaydı hatası')
      return NextResponse.json(
        { error: 'Mesaj kaydetme hatası', details: dbError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, channel: 'web' })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Mesaj gönderilemedi'
    log.error({ err, businessId: ctx.businessId }, 'Mesaj gönderme API hatası')
    return NextResponse.json(
      { error: 'Mesaj gönderme hatası', details: message },
      { status: 500 },
    )
  }
})
