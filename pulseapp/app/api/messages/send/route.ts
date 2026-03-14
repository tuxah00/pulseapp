import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendWhatsAppMessage } from '@/lib/whatsapp/send'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
    }

    const body = await request.json()
    const { customerId, businessId, content, messageType = 'text' } = body

    if (!customerId || !businessId || !content) {
      return NextResponse.json(
        { error: 'customerId, businessId ve content gerekli' },
        { status: 400 },
      )
    }

    const admin = createAdminClient()

    const { data: customer } = await admin
      .from('customers')
      .select('id, phone, name, whatsapp_opted_in')
      .eq('id', customerId)
      .eq('business_id', businessId)
      .single()

    if (!customer) {
      return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
    }

    const { data: waAccount } = await admin
      .from('whatsapp_accounts')
      .select('status')
      .eq('business_id', businessId)
      .eq('status', 'active')
      .single()

    const hasMetaWhatsApp = !!waAccount

    const hasTwilioLegacy =
      !hasMetaWhatsApp &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      !process.env.TWILIO_ACCOUNT_SID.startsWith('AC...')

    const canSendWhatsApp = (hasMetaWhatsApp || hasTwilioLegacy) && customer.whatsapp_opted_in

    if (canSendWhatsApp) {
      const result = await sendWhatsAppMessage({
        to: customer.phone,
        body: content,
        businessId,
        customerId,
        messageType: messageType as any,
      })

      if (!result.success) {
        return NextResponse.json(
          { error: 'WhatsApp gönderim hatası', details: result.error },
          { status: 500 },
        )
      }

      return NextResponse.json({
        success: true,
        channel: 'whatsapp',
        provider: result.channel,
        messageId: result.messageId,
      })
    }

    const { error: dbError } = await admin.from('messages').insert({
      business_id: businessId,
      customer_id: customerId,
      direction: 'outbound',
      channel: 'web',
      message_type: messageType,
      content,
    })

    if (dbError) {
      return NextResponse.json(
        { error: 'Mesaj kaydetme hatası', details: dbError.message },
        { status: 500 },
      )
    }

    return NextResponse.json({ success: true, channel: 'web' })
  } catch (error: any) {
    console.error('Mesaj gönderme API hatası:', error)
    return NextResponse.json(
      { error: 'Mesaj gönderme hatası', details: error.message },
      { status: 500 },
    )
  }
}
