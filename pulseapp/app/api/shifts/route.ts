import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// GET: Haftalık vardiye listesi
export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const weekStart = searchParams.get('weekStart') // YYYY-MM-DD (Pazartesi)
  const weekEnd = searchParams.get('weekEnd')   // YYYY-MM-DD (Pazar)

  if (!businessId || !weekStart || !weekEnd) {
    return NextResponse.json({ error: 'businessId, weekStart, weekEnd gerekli' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shifts')
    .select('*, staff_members(id, name, avatar_url)')
    .eq('business_id', businessId)
    .gte('shift_date', weekStart)
    .lte('shift_date', weekEnd)
    .order('shift_date')
    .order('start_time')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shifts: data })
}

// POST: Yeni vardiya ekle
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, staffId, shiftDate, startTime, endTime, shiftType = 'regular', notes } = body

  if (!businessId || !staffId || !shiftDate || !shiftType) {
    return NextResponse.json({ error: 'businessId, staffId, shiftDate zorunlu' }, { status: 400 })
  }

  if (shiftType === 'regular' && (!startTime || !endTime)) {
    return NextResponse.json({ error: 'Vardiya tipi için başlangıç ve bitiş saati zorunlu' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('shifts')
    .upsert({
      business_id: businessId,
      staff_id: staffId,
      shift_date: shiftDate,
      start_time: shiftType === 'off' ? null : startTime,
      end_time: shiftType === 'off' ? null : endTime,
      shift_type: shiftType,
      notes: notes || null,
      created_by: user.id,
    }, { onConflict: 'business_id,staff_id,shift_date' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift: data })
}
