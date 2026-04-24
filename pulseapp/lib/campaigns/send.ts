import type { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { matchesCampaignFilter } from '@/lib/utils/campaign-filters'
import type { CampaignSegmentFilter, MessageChannel } from '@/types'

type SupabaseAdmin = ReturnType<typeof createAdminClient>

/**
 * Kampanyayı gönderir. Çalıştırdığı adımlar:
 * 1) Hedef müşterileri çek + filtrele
 * 2) campaign_recipients'a satır at
 * 3) Her müşteriye sendMessage ile gönder (sıralı, rate-limit dostu)
 * 4) Stats hesapla + campaigns status='completed' yap
 */
export async function sendCampaign(
  admin: SupabaseAdmin,
  campaignId: string,
  businessId: string,
  segmentFilter: CampaignSegmentFilter,
  messageTemplate: string,
  channel: MessageChannel | 'auto',
) {
  let query = admin
    .from('customers')
    .select('id, name, phone, segment, last_visit_at, total_visits, total_revenue, created_at, birthday')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (segmentFilter.segments?.length) {
    query = query.in('segment', segmentFilter.segments)
  }

  const { data: customers } = await query

  if (!customers?.length) {
    await admin
      .from('campaigns')
      .update({ status: 'completed', stats: { total_recipients: 0, sent: 0, errors: 0 } })
      .eq('id', campaignId)
    return
  }

  const now = new Date()
  const filtered = customers.filter((c) => c.phone && matchesCampaignFilter(c, segmentFilter, now))

  const stats = { total_recipients: filtered.length, sent: 0, errors: 0 }

  // Recipient ID'lerini almak için insert'i select ile yap.
  // Her recipient'in ID'si {LINK} rendering'de attribution query param'ı olarak kullanılır.
  const [recipientInsertResult, { data: bizRow }] = await Promise.all([
    filtered.length > 0
      ? admin.from('campaign_recipients').insert(
          filtered.map((c) => ({
            campaign_id: campaignId,
            customer_id: c.id,
            customer_name: c.name,
            customer_phone: c.phone,
            status: 'pending',
          })),
        ).select('id, customer_id')
      : Promise.resolve({ data: null } as const),
    admin.from('businesses').select('name').eq('id', businessId).single(),
  ])

  const bizName = bizRow?.name || ''

  // customer_id → recipient_id eşleme tablosu
  const recipientByCustomer = new Map<string, string>()
  for (const row of (recipientInsertResult.data ?? []) as Array<{ id: string; customer_id: string }>) {
    recipientByCustomer.set(row.customer_id, row.id)
  }

  // {LINK} için base URL (NEXT_PUBLIC_APP_URL zorunlu env — CLAUDE.md)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

  for (const customer of filtered) {
    const recipientId = recipientByCustomer.get(customer.id) || ''
    // Attribution link: /book/<businessId>?c=<recipient_id>
    // Public booking sayfası query param'ı koruyarak POST /api/book?c=... yapar
    const bookingLink = appUrl && recipientId
      ? `${appUrl}/book/${businessId}?c=${recipientId}`
      : ''

    const body = messageTemplate
      .replace(/\{name\}/gi, customer.name)
      .replace(/\{businessName\}/gi, bizName)
      .replace(/\{LINK\}/gi, bookingLink)
      .replace(/\{link\}/gi, bookingLink)

    try {
      await sendMessage({
        to: customer.phone,
        body,
        businessId,
        customerId: customer.id,
        messageType: 'system',
        channel,
      })

      await admin
        .from('campaign_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('customer_id', customer.id)

      stats.sent++
    } catch (e) {
      await admin
        .from('campaign_recipients')
        .update({ status: 'failed', error_message: e instanceof Error ? e.message : 'Bilinmeyen hata' })
        .eq('campaign_id', campaignId)
        .eq('customer_id', customer.id)
      stats.errors++
    }
  }

  await admin
    .from('campaigns')
    .update({ status: 'completed', stats })
    .eq('id', campaignId)
}
