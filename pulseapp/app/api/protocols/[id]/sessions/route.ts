import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

// PATCH: Seans güncelle (tamamla, atla, iptal et)
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { businessId, sessionId, status, appointmentId, notes, completedDate, beforePhotoUrl, afterPhotoUrl } = body

  if (!businessId || !sessionId) {
    return NextResponse.json({ error: 'businessId ve sessionId zorunlu' }, { status: 400 })
  }

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  const admin = createAdminClient()

  const updateData: Record<string, unknown> = {}
  if (status) updateData.status = status
  if (appointmentId !== undefined) updateData.appointment_id = appointmentId
  if (notes !== undefined) updateData.notes = notes
  if (completedDate) updateData.completed_date = completedDate
  if (beforePhotoUrl) updateData.before_photo_url = beforePhotoUrl
  if (afterPhotoUrl) updateData.after_photo_url = afterPhotoUrl

  // Seans completed olursa completed_date otomatik doldur
  if (status === 'completed' && !completedDate) {
    updateData.completed_date = new Date().toISOString().split('T')[0]
  }

  const { data: session, error } = await admin
    .from('protocol_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Protokolün completed_sessions sayısını güncelle
  if (status === 'completed' || status === 'skipped') {
    const { count } = await admin
      .from('protocol_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('protocol_id', params.id)
      .eq('status', 'completed')

    const completedCount = count ?? 0
    const protocolUpdate: Record<string, unknown> = { completed_sessions: completedCount }

    // Protokolün total_sessions'ına bakarak otomatik tamamla
    const { data: protocol } = await admin
      .from('treatment_protocols')
      .select('total_sessions')
      .eq('id', params.id)
      .single()

    if (protocol && completedCount >= protocol.total_sessions) {
      protocolUpdate.status = 'completed'
    }

    await admin
      .from('treatment_protocols')
      .update(protocolUpdate)
      .eq('id', params.id)
  }

  return NextResponse.json({ session })
}
