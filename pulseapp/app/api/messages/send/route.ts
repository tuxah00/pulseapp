import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sendMessage } from '@/lib/messaging/send'
import { withPermission } from '@/lib/api/with-permission'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import type { MessageChannel } from '@/types'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/messages/send' })

export const POST = withPermission('messages', async (req: NextRequest, ctx) => {
  // Rate limit kontrolü
  const rl = checkRateLimit(req, RATE_LIMITS.messaging)
  if (rl.limited) return rl.response

  try {
    const body = await req.json()
    const { customerId, content, messageType = 'text', channel = 'auto' } = body

    if (!customerId || !content) {
      return NextResponse.json(
        { error: 'customerId ve content gerekli' },
        { status: 400 },
      )
    }

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

    // Birleşik mesaj gönderim — kanal otomatik veya manuel seçilebilir
    if (customer.phone) {
      const result = await sendMessage({
        to: customer.phone,
        body: content,
        businessId: ctx.businessId,
        customerId,
        messageType: messageType as any,
        channel: channel as MessageChannel | 'auto',
      })

      return NextResponse.json({
        success: result.success,
        channel: result.channel,
        messageSid: result.messageSid,
        staffName: ctx.staffId,
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
    })

    if (dbError) {
      return NextResponse.json(
        { error: 'Mesaj kaydetme hatası', details: dbError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, channel: 'web' })
  } catch (error: any) {
    log.error({ err: error }, 'Mesaj gönderme API hatası')
    return NextResponse.json(
      { error: 'Mesaj gönderme hatası', details: error.message },
      { status: 500 },
    )
  }
})
