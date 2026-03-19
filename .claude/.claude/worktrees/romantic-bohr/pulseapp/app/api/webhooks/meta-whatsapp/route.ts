import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyWebhookSignature, markMessageRead } from '@/lib/whatsapp/meta-client'
import { decrypt } from '@/lib/whatsapp/crypto'
import { handleConversation } from '@/lib/whatsapp/conversation-handler'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN

  if (mode === 'subscribe' && token === verifyToken) {
    return new NextResponse(challenge, { status: 200 })
  }

  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request: NextRequest) {
  try {
    const bodyText = await request.text()

    if (process.env.NODE_ENV === 'production') {
      const signature = request.headers.get('x-hub-signature-256') || ''
      const appSecret = process.env.META_APP_SECRET
      if (!appSecret || !verifyWebhookSignature(bodyText, signature, appSecret)) {
        console.error('Geçersiz Meta webhook imzası')
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const payload = JSON.parse(bodyText)

    if (payload.object !== 'whatsapp_business_account') {
      return NextResponse.json({ status: 'ignored' })
    }

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== 'messages') continue

        const value = change.value
        if (!value?.messages?.length) continue

        const phoneNumberId = value.metadata?.phone_number_id
        if (!phoneNumberId) continue

        for (const message of value.messages) {
          await processInboundMessage(phoneNumberId, message, value.contacts)
        }
      }
    }

    return NextResponse.json({ status: 'ok' })
  } catch (error: any) {
    console.error('Meta webhook hatası:', error)
    return NextResponse.json({ status: 'ok' })
  }
}

async function processInboundMessage(
  phoneNumberId: string,
  message: any,
  contacts: any[],
) {
  const supabase = createAdminClient()

  const { data: waAccount } = await supabase
    .from('whatsapp_accounts')
    .select('business_id, access_token_encrypted')
    .eq('phone_number_id', phoneNumberId)
    .eq('status', 'active')
    .single()

  if (!waAccount) {
    console.error(`Aktif WhatsApp hesabı bulunamadı: phone_number_id=${phoneNumberId}`)
    return
  }

  const businessId = waAccount.business_id

  const senderPhone = message.from
  const messageBody = message.type === 'text' ? message.text?.body || '' : ''
  const metaMessageId = message.id
  const senderName = contacts?.[0]?.profile?.name || ''

  if (!messageBody.trim()) return

  try {
    const accessToken = decrypt(waAccount.access_token_encrypted)
    await markMessageRead(phoneNumberId, accessToken, metaMessageId)
  } catch {
    // Okundu bildirimi gönderilemezse devam et
  }

  const normalizedPhone = normalizePhoneForLookup(senderPhone)

  const { data: customer } = await supabase
    .from('customers')
    .select('id, business_id, name, phone, segment')
    .eq('business_id', businessId)
    .or(`phone.eq.${normalizedPhone},phone.eq.+${senderPhone},phone.eq.0${senderPhone.replace(/^90/, '')}`)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!customer) {
    await supabase.from('notifications').insert({
      business_id: businessId,
      type: 'customer',
      title: `Kayıtsız numaradan WhatsApp mesajı`,
      body: `${senderName || senderPhone}: ${messageBody.slice(0, 100)}`,
      related_type: 'whatsapp',
    })
    return
  }

  const { data: business } = await supabase
    .from('businesses')
    .select('name, sector, settings, working_hours, address, google_maps_url')
    .eq('id', businessId)
    .single()

  if (!business) return

  const { data: inboundMessage } = await supabase
    .from('messages')
    .insert({
      business_id: businessId,
      customer_id: customer.id,
      direction: 'inbound',
      channel: 'whatsapp',
      message_type: 'text',
      content: messageBody,
      meta_message_id: metaMessageId,
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
}

function normalizePhoneForLookup(phone: string): string {
  let cleaned = phone.replace(/[\s\-+()]/g, '')
  if (cleaned.startsWith('90') && cleaned.length > 10) {
    cleaned = '0' + cleaned.slice(2)
  }
  return cleaned
}
