import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStaffInfo, sendCampaign } from '@/app/api/campaigns/route'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { campaignId } = await request.json()
  if (!campaignId) return NextResponse.json({ error: 'campaignId gerekli' }, { status: 400 })

  const { data: campaign } = await supabase
    .from('campaigns')
    .select('id, business_id, segment_filter, message_template, channel, status')
    .eq('id', campaignId)
    .eq('business_id', staff.business_id)
    .single()

  if (!campaign) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 })
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    return NextResponse.json({ error: 'Sadece taslak veya planlanmış kampanyalar gönderilebilir' }, { status: 400 })
  }

  const admin = createAdminClient()
  await admin.from('campaigns').update({ status: 'sending' }).eq('id', campaignId)

  try {
    await sendCampaign(
      admin,
      campaign.id,
      campaign.business_id,
      campaign.segment_filter,
      campaign.message_template,
      campaign.channel
    )
  } catch (e: any) {
    await admin.from('campaigns').update({ status: 'draft' }).eq('id', campaignId)
    return NextResponse.json({ error: e?.message || 'Gönderim sırasında hata oluştu' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
