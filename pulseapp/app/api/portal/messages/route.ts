import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalMessageCreateSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/messages' })

/**
 * GET /api/portal/messages?since=<iso>
 *
 * Müşterinin salonla olan mesajlaşma geçmişi (her iki yönü).
 * `?since=<iso>` verilirse o tarihten sonraki mesajlar (polling için).
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const { searchParams } = new URL(request.url)
  const since = searchParams.get('since')

  const admin = createAdminClient()
  let q = admin
    .from('messages')
    .select('id, direction, channel, content, staff_name, created_at, is_read')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: true })
    .limit(500)

  if (since && /^\d{4}-\d{2}-\d{2}T/.test(since)) {
    q = q.gt('created_at', since)
  }

  const { data, error } = await q
  if (error) {
    log.error({ err: error, businessId, customerId }, 'Mesajlar yüklenemedi')
    return NextResponse.json({ error: 'Mesajlar yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ messages: data || [] })
}

/**
 * POST /api/portal/messages — müşteri yeni inbound mesaj gönderir.
 *
 * channel='web', direction='inbound'. Salon tarafı /dashboard/messages'da
 * mevcut akış üzerinden bunu görür ve yanıtlar.
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalMessageCreateSchema)
  if (!parsed.ok) return parsed.response
  const { content } = parsed.data

  const admin = createAdminClient()

  const { data: message, error } = await admin
    .from('messages')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      direction: 'inbound',
      channel: 'web',
      content,
      is_read: false,
    })
    .select('id, direction, channel, content, staff_name, created_at, is_read')
    .single()

  if (error || !message) {
    log.error({ err: error, businessId, customerId }, 'Mesaj kaydedilemedi')
    return NextResponse.json({ error: 'Mesaj gönderilemedi' }, { status: 500 })
  }

  // Salon tarafına bildirim
  try {
    const { data: customer } = await admin
      .from('customers')
      .select('name')
      .eq('id', customerId)
      .single()
    await admin.from('notifications').insert({
      business_id: businessId,
      type: 'message',
      title: 'Yeni Müşteri Mesajı',
      body: `${customer?.name || 'Müşteri'}: ${content.slice(0, 80)}`,
      related_id: message.id,
      related_type: 'message',
      is_read: false,
    })
  } catch {
    /* bildirim hatası mesajı bloklamasın */
  }

  return NextResponse.json({ message })
}
