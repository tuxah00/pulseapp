import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// PUT: Vardiya güncelle
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('shifts')
    .select('business_id')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })

  const { data: membership } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('business_id', existing.business_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const body = await request.json()
  const { startTime, endTime, shiftType, notes } = body

  const { data, error } = await admin
    .from('shifts')
    .update({
      start_time: shiftType === 'off' ? null : startTime,
      end_time: shiftType === 'off' ? null : endTime,
      shift_type: shiftType,
      notes: notes || null,
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ shift: data })
}

// DELETE: Vardiya sil
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('shifts')
    .select('business_id')
    .eq('id', params.id)
    .single()

  if (!existing) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })

  const { data: membership } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .eq('business_id', existing.business_id)
    .single()

  if (!membership) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const { error } = await admin
    .from('shifts')
    .delete()
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
