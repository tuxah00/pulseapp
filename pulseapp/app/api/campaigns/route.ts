import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditServer } from '@/lib/utils/audit'
import { sendCampaign } from '@/lib/campaigns/send'

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

