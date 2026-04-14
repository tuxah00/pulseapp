import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendCampaign } from '@/lib/campaigns/send'

/**
 * Zamanlanmış kampanyaları işler.
 * Her saat çalışır. scheduled_at geçmiş olan kampanyaları başlatır.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const results = { processed: 0, sent: 0, errors: 0 }

  // scheduled_at geçmiş, hâlâ 'scheduled' durumunda olan kampanyaları al
  const { data: dueCampaigns } = await admin
    .from('campaigns')
    .select('id, business_id, segment_filter, message_template, channel')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())

  for (const campaign of dueCampaigns || []) {
    try {
      // Önce 'sending' durumuna al (çift çalışmayı önle)
      await admin
        .from('campaigns')
        .update({ status: 'sending' })
        .eq('id', campaign.id)

      await sendCampaign(
        admin,
        campaign.id,
        campaign.business_id,
        campaign.segment_filter,
        campaign.message_template,
        campaign.channel
      )

      results.sent++
    } catch {
      await admin
        .from('campaigns')
        .update({ status: 'scheduled' }) // hata olursa geri al
        .eq('id', campaign.id)
      results.errors++
    }

    results.processed++
  }

  return NextResponse.json({ ok: true, timestamp: now.toISOString(), ...results })
}
