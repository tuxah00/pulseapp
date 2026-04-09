import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// GET: Takip listesi (bekleyen, gönderilenler)
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const status = searchParams.get('status') || 'pending'

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { data, error } = await supabase
    .from('follow_up_queue')
    .select(`
      *,
      customer:customers(id, name, phone),
      appointment:appointments(id, appointment_date, start_time, service_id,
        service:services(name)
      )
    `)
    .eq('business_id', businessId)
    .eq('status', status)
    .order('scheduled_for', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followUps: data })
}

// POST: Yeni takip kaydı oluştur
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, appointmentId, customerId, protocolId, type, scheduledFor, message } = body

  if (!businessId || !appointmentId || !customerId || !type || !scheduledFor) {
    return NextResponse.json({ error: 'Eksik alanlar' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { data, error } = await supabase
    .from('follow_up_queue')
    .insert({
      business_id: businessId,
      appointment_id: appointmentId,
      customer_id: customerId,
      protocol_id: protocolId || null,
      type,
      scheduled_for: scheduledFor,
      message: message || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followUp: data }, { status: 201 })
}

// PATCH: Takip durumunu güncelle (gönderildi/iptal)
export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, id, status } = body

  if (!businessId || !id || !status) {
    return NextResponse.json({ error: 'businessId, id, status zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { data, error } = await supabase
    .from('follow_up_queue')
    .update({ status })
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ followUp: data })
}
