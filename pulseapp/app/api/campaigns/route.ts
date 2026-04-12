import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { logAuditServer } from '@/lib/utils/audit'
import { matchesCampaignFilter } from '@/lib/utils/campaign-filters'
import type { CampaignSegmentFilter } from '@/types'

export async function getStaffInfo(supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  return staff
}

// GET — Kampanya listesi
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data, error } = await supabase
    .from('campaigns')
    .select('*')
    .eq('business_id', staff.business_id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ campaigns: data || [] })
}

// POST — Yeni kampanya oluştur (draft veya scheduled)
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { name, description, segmentFilter, messageTemplate, channel, scheduledAt, sendNow } = body

  if (!name || !messageTemplate) {
    return NextResponse.json({ error: 'Ad ve mesaj şablonu zorunludur' }, { status: 400 })
  }

  const status = sendNow ? 'sending' : (scheduledAt ? 'scheduled' : 'draft')

  const { data: campaign, error } = await supabase
    .from('campaigns')
    .insert({
      business_id: staff.business_id,
      name,
      description: description || null,
      segment_filter: segmentFilter || {},
      message_template: messageTemplate,
      channel: channel || 'auto',
      scheduled_at: scheduledAt || null,
      status,
      created_by_staff_id: staff.id,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'create',
    resource: 'campaign',
    resourceId: campaign.id,
    details: { name, status },
  })

  // Hemen gönder seçildiyse kitleyi hesapla ve gönder
  if (sendNow) {
    const admin = createAdminClient()
    await sendCampaign(admin, campaign.id, staff.business_id, segmentFilter || {}, messageTemplate, channel || 'auto')
  }

  return NextResponse.json({ campaign })
}

// PATCH — Kampanya güncelle / iptal et
export async function PATCH(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { id, name, description, segmentFilter, messageTemplate, channel, scheduledAt, status } = body

  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  const allowed: Record<string, any> = { updated_at: new Date().toISOString() }
  if (name !== undefined) allowed.name = name
  if (description !== undefined) allowed.description = description
  if (segmentFilter !== undefined) allowed.segment_filter = segmentFilter
  if (messageTemplate !== undefined) allowed.message_template = messageTemplate
  if (channel !== undefined) allowed.channel = channel
  if (scheduledAt !== undefined) allowed.scheduled_at = scheduledAt
  if (status !== undefined) allowed.status = status

  const { error } = await supabase
    .from('campaigns')
    .update(allowed)
    .eq('id', id)
    .eq('business_id', staff.business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'cancelled') {
    await logAuditServer({
      businessId: staff.business_id,
      staffId: staff.id,
      staffName: staff.name,
      action: 'cancel',
      resource: 'campaign',
      resourceId: id,
    })
  }

  return NextResponse.json({ ok: true })
}

// DELETE — Kampanya sil (sadece draft/cancelled)
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'ID gerekli' }, { status: 400 })

  // Sadece draft veya cancelled kampanyalar silinebilir
  const { data: camp } = await supabase
    .from('campaigns')
    .select('status')
    .eq('id', id)
    .eq('business_id', staff.business_id)
    .single()

  if (!camp) return NextResponse.json({ error: 'Kampanya bulunamadı' }, { status: 404 })
  if (!['draft', 'cancelled'].includes(camp.status)) {
    return NextResponse.json({ error: 'Sadece taslak veya iptal edilmiş kampanyalar silinebilir' }, { status: 400 })
  }

  const { error } = await supabase
    .from('campaigns')
    .delete()
    .eq('id', id)
    .eq('business_id', staff.business_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'delete',
    resource: 'campaign',
    resourceId: id,
  })

  return NextResponse.json({ ok: true })
}

export async function sendCampaign(
  admin: ReturnType<typeof createAdminClient>,
  campaignId: string,
  businessId: string,
  segmentFilter: CampaignSegmentFilter,
  messageTemplate: string,
  channel: string
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
  const filtered = customers.filter(c => c.phone && matchesCampaignFilter(c, segmentFilter, now))

  const stats = { total_recipients: filtered.length, sent: 0, errors: 0 }

  const [, { data: bizRow }] = await Promise.all([
    filtered.length > 0
      ? admin.from('campaign_recipients').insert(
          filtered.map(c => ({
            campaign_id: campaignId,
            customer_id: c.id,
            customer_name: c.name,
            customer_phone: c.phone,
            status: 'pending',
          }))
        )
      : Promise.resolve(null),
    admin.from('businesses').select('name').eq('id', businessId).single(),
  ])

  const bizName = bizRow?.name || ''

  for (const customer of filtered) {
    const body = messageTemplate
      .replace(/\{name\}/gi, customer.name)
      .replace(/\{businessName\}/gi, bizName)

    try {
      await sendMessage({
        to: customer.phone,
        body,
        businessId,
        customerId: customer.id,
        messageType: 'system',
        channel: channel as any,
      })

      await admin
        .from('campaign_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString() })
        .eq('campaign_id', campaignId)
        .eq('customer_id', customer.id)

      stats.sent++
    } catch (e: any) {
      await admin
        .from('campaign_recipients')
        .update({ status: 'failed', error_message: e?.message || 'Bilinmeyen hata' })
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
