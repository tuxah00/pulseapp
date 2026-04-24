import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireWritePermission } from '@/lib/api/with-permission'
import { createServerSupabaseClient } from '@/lib/supabase/server'

// GET: Protokol detayı
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(request, 'protocols')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx
  const supabase = createServerSupabaseClient()

  const { data, error } = await supabase
    .from('treatment_protocols')
    .select(`
      *,
      customer:customers(id, name, phone, email, segment),
      service:services(id, name, duration_minutes, price),
      staff:staff_members!treatment_protocols_created_by_fkey(id, name),
      sessions:protocol_sessions(
        *,
        appointment:appointments(id, appointment_date, start_time, status)
      )
    `)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Protokol bulunamadı' }, { status: 404 })

  return NextResponse.json({ protocol: data })
}

// PATCH: Protokol güncelle
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(request, 'protocols')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx
  const supabase = createServerSupabaseClient()

  const body = await request.json()
  const { status, notes, intervalDays } = body

  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (notes !== undefined) updateData.notes = notes
  if (intervalDays) updateData.interval_days = intervalDays

  const { data, error } = await supabase
    .from('treatment_protocols')
    .update(updateData)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ protocol: data })
}

// DELETE: Protokol sil
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(request, 'protocols')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx
  const supabase = createServerSupabaseClient()

  const { error } = await supabase
    .from('treatment_protocols')
    .delete()
    .eq('id', params.id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
