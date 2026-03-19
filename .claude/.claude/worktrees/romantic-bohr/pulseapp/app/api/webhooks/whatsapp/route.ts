import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleConversation } from '@/lib/whatsapp/conversation-handler'
import twilio from 'twilio'

function validateTwilioRequest(request: NextRequest, body: string): boolean {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  if (!authToken) return false

  const signature = request.headers.get('x-twilio-signature') || ''
  const url = `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/whatsapp`

  const params: Record<string, string> = {}
  new URLSearchParams(body).forEach((value, key) => {
    params[key] = value
  })

  return twilio.validateRequest(authToken, signature, url, params)
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text()

    if (process.env.NODE_ENV === 'production') {
      if (!validateTwilioRequest(request, bodyText)) {
        console.error('Geçersiz Twilio imzası')
        return new NextResponse('Forbidden', { status: 403 })
      }
    }

    const params = new URLSearchParams(bodyText)
    const from = params.get('From') || ''
    const messageBody = params.get('Body') || ''
    const twilioSid = params.get('MessageSid') || ''

    const phone = from.replace('whatsapp:', '').replace('+90', '0').replace('+', '')

    if (!messageBody.trim()) {
      return twimlResponse('Mesajınız alındı.')
    }

    const supabase = createAdminClient()

    const { data: customer } = await supabase
      .from('customers')
      .select('id, business_id, name, phone, segment')
      .or(`phone.eq.${phone},phone.eq.+90${phone.replace(/^0/, '')}`)
      .eq('is_active', true)
      .limit(1)
      .single()

    if (!customer) {
      return twimlResponse(
        'Merhaba! Henüz sistemimizde kayıtlı değilsiniz. Lütfen işletmemizi arayarak kayıt olun.'
      )
    }

    const businessId = customer.business_id

    const { data: business } = await supabase
      .from('businesses')
      .select('name, sector, settings, working_hours, address, google_maps_url')
      .eq('id', businessId)
      .single()

    if (!business) {
      return twimlResponse('Bir hata oluştu. Lütfen daha sonra tekrar deneyin.')
    }

    const { data: inboundMessage } = await supabase
      .from('messages')
      .insert({
        business_id: businessId,
        customer_id: customer.id,
        direction: 'inbound',
        channel: 'whatsapp',
        message_type: 'text',
        content: messageBody,
        twilio_sid: twilioSid,
        twilio_status: 'received',
      })
      .select('id')
      .single()

    const { replied, classification, summary } = await handleConversation({
      businessId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      messageBody,
      inboundMessageId: inboundMessage?.id || null,
      business: {
        name: business.name,
        sector: business.sector,
        settings: business.settings,
        working_hours: business.working_hours,
        address: business.address,
        google_maps_url: business.google_maps_url,
      },
    })

    if (!replied) {
      await supabase.from('notifications').insert({
        business_id: businessId,
        type: classification === 'complaint' ? 'customer' : 'appointment',
        title: `Yeni WhatsApp mesajı: ${customer.name}`,
        body: summary || messageBody.slice(0, 100),
        related_id: customer.id,
        related_type: 'customer',
      })
    }

    return twimlResponse()
  } catch (error: any) {
    console.error('Webhook hatası:', error)
    return twimlResponse('Bir hata oluştu.')
  }
}

function twimlResponse(message?: string): NextResponse {
  const body = message
    ? `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`
    : '<?xml version="1.0" encoding="UTF-8"?><Response></Response>'

  return new NextResponse(body, {
    headers: { 'Content-Type': 'text/xml' },
  })
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
