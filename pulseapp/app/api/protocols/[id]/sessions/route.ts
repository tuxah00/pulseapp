import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { validateBody } from '@/lib/api/validate'
import { sessionPatchSchema } from '@/lib/schemas'

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

  const result = await validateBody(request, sessionPatchSchema)
  if (!result.ok) return result.response
  const { businessId, sessionId, status, appointmentId, notes, completedDate, beforePhotoUrl, afterPhotoUrl } = result.data

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

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

  // Seans completed olunca: post_care_notes zaten manuel girilmemişse,
  // hizmetin default_post_care_notes değerini seansa kopyala (override edilebilir).
  if (status === 'completed') {
    const { data: existingSession } = await supabase
      .from('protocol_sessions')
      .select('post_care_notes, post_care_files, protocol_id')
      .eq('id', sessionId)
      .single()

    const noPostCareYet =
      !existingSession?.post_care_notes &&
      (!existingSession?.post_care_files || (Array.isArray(existingSession.post_care_files) && existingSession.post_care_files.length === 0))

    if (noPostCareYet && existingSession?.protocol_id) {
      const { data: protocolWithService } = await supabase
        .from('treatment_protocols')
        .select('service_id')
        .eq('id', existingSession.protocol_id)
        .single()
      if (protocolWithService?.service_id) {
        const { data: service } = await supabase
          .from('services')
          .select('default_post_care_notes, default_post_care_files')
          .eq('id', protocolWithService.service_id)
          .single()
        if (service?.default_post_care_notes) {
          updateData.post_care_notes = service.default_post_care_notes
        }
        if (Array.isArray(service?.default_post_care_files) && service.default_post_care_files.length > 0) {
          updateData.post_care_files = service.default_post_care_files
        }
      }
    }
  }

  const { data: session, error } = await supabase
    .from('protocol_sessions')
    .update(updateData)
    .eq('id', sessionId)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Protokolün completed_sessions sayısını güncelle
  if (status === 'completed' || status === 'skipped') {
    const [{ count: completedCountRaw }, { count: resolvedCountRaw }] = await Promise.all([
      supabase
        .from('protocol_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('protocol_id', params.id)
        .eq('status', 'completed'),
      supabase
        .from('protocol_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('protocol_id', params.id)
        .in('status', ['completed', 'skipped']),
    ])

    const completedCount = completedCountRaw ?? 0
    const resolvedCount = resolvedCountRaw ?? 0
    const protocolUpdate: Record<string, unknown> = { completed_sessions: completedCount }

    // Protokolün total_sessions'ına bakarak otomatik tamamla
    // (tüm seanslar completed veya skipped ise — atlanan seanslar protokolü bloklamamalı)
    const { data: protocol } = await supabase
      .from('treatment_protocols')
      .select('total_sessions')
      .eq('id', params.id)
      .single()

    if (protocol && resolvedCount >= protocol.total_sessions) {
      protocolUpdate.status = 'completed'
    }

    await supabase
      .from('treatment_protocols')
      .update(protocolUpdate)
      .eq('id', params.id)
  }

  return NextResponse.json({ session })
}
