import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Belirli tarih aralığı için bloklanmış slotları getir
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  let query = supabase
    .from('blocked_slots')
    .select('*')
    .eq('business_id', businessId)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true })

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ blockedSlots: data })
}

// POST: Yeni bloklanmış slot(lar) oluştur
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, slots } = body as {
    businessId: string
    slots: Array<{
      date: string
      start_time: string
      end_time: string
      staff_id?: string
      room_id?: string
      reason?: string
    }>
  }

  if (!businessId || !slots?.length) {
    return NextResponse.json({ error: 'businessId ve slots gerekli' }, { status: 400 })
  }

  const records = slots.map(s => ({
    business_id: businessId,
    date: s.date,
    start_time: s.start_time,
    end_time: s.end_time,
    staff_id: s.staff_id || null,
    room_id: s.room_id || null,
    reason: s.reason || null,
    created_by: user.id,
  }))

  const { data, error } = await supabase
    .from('blocked_slots')
    .insert(records)
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ blockedSlots: data }, { status: 201 })
}

// DELETE: Bloklanmış slot sil
export async function DELETE(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const businessId = searchParams.get('businessId')

  if (!id || !businessId) {
    return NextResponse.json({ error: 'id ve businessId gerekli' }, { status: 400 })
  }

  const { error } = await supabase
    .from('blocked_slots')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
