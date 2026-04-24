import type { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { matchesCampaignFilter } from '@/lib/utils/campaign-filters'
import { generateShortCode } from '@/lib/utils/short-code'
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
  // short_code: 8 karakterli URL-safe kod, /r/<code> formatında kısa link üretir.
  const [recipientInsertResult, { data: bizRow }] = await Promise.all([
    filtered.length > 0
      ? admin.from('campaign_recipients').insert(
          filtered.map((c) => ({
            campaign_id: campaignId,
            customer_id: c.id,
            customer_name: c.name,
            customer_phone: c.phone,
            status: 'pending',
            short_code: generateShortCode(),
          })),
        ).select('id, customer_id, short_code')
      : Promise.resolve({ data: null } as const),
    admin.from('businesses').select('name').eq('id', businessId).single(),
  ])

  const bizName = bizRow?.name || ''

  // customer_id → short_code eşleme tablosu ({LINK} rendering için)
  const shortCodeByCustomer = new Map<string, string>()
  for (const row of (recipientInsertResult.data ?? []) as Array<{ id: string; customer_id: string; short_code: string | null }>) {
    if (row.short_code) shortCodeByCustomer.set(row.customer_id, row.short_code)
  }

  // {LINK} için base URL (NEXT_PUBLIC_APP_URL zorunlu env — CLAUDE.md)
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')

  for (const customer of filtered) {
    const shortCode = shortCodeByCustomer.get(customer.id) || ''
    // Kısa link: /r/<short_code> → app/r/[code]/page.tsx redirect handler
    // Eski link yaklaşımı (/book/<uuid>?c=<uuid>) yerine yaklaşık 65 karakter tasarruf.
    const bookingLink = appUrl && shortCode ? `${appUrl}/r/${shortCode}` : ''

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
