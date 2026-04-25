// app/api/consultations/[id]/route.ts
// GET (tek talep), PATCH (status güncelle), DELETE

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission, requireWritePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditServer } from '@/lib/utils/audit'
import { consultationUpdateSchema } from '@/lib/schemas'

// GET — tek talep + fotoğraflar + müşteri
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission(req, 'consultations')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('consultation_requests')
    .select(`
      *,
      service:services(id, name),
      customer:customers(id, name, phone, segment, email)
    `)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 })
  }

  return NextResponse.json({ data })
}

// PATCH — status + karar gerekçesi
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(req, 'consultations')
  if (!auth.ok) return auth.response
  const { businessId, staffId, staffName } = auth.ctx

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Geçersiz istek.' }, { status: 400 })
  }

  const parsed = consultationUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri.' }, { status: 400 })
  }

  const { status, decisionReason } = parsed.data

  const supabase = createAdminClient()

  // Talebin bu işletmeye ait olduğunu doğrula
  const { data: existing } = await supabase
    .from('consultation_requests')
    .select('id, status')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 })
  }

  const updatePayload: Record<string, unknown> = {}
  if (status) updatePayload.status = status
  if (decisionReason !== undefined) updatePayload.decision_reason = decisionReason

  if (status && ['suitable', 'not_suitable', 'needs_more_info'].includes(status)) {
    updatePayload.reviewed_by_staff_id = staffId
    updatePayload.reviewed_by_staff_name = staffName
    updatePayload.reviewed_at = new Date().toISOString()
  }

  const { data: updated, error: updateError } = await supabase
    .from('consultation_requests')
    .update(updatePayload)
    .eq('id', params.id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  await logAuditServer({
    businessId,
    staffId,
    staffName,
    action: 'status_change',
    resource: 'consultation_request',
    resourceId: params.id,
    details: { oldStatus: existing.status, newStatus: status ?? null, decisionReason: decisionReason || null },
  })

  return NextResponse.json({ data: updated })
}

// DELETE — talebi sil, fotoğrafları Storage'tan temizle
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireWritePermission(req, 'consultations')
  if (!auth.ok) return auth.response
  const { businessId, staffId, staffName } = auth.ctx

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('consultation_requests')
    .select('id, photo_urls')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Talep bulunamadı.' }, { status: 404 })
  }

  // Storage'dan fotoğrafları temizle
  const photoUrls = (existing.photo_urls as { path: string }[]) || []
  const paths = photoUrls.map(p => p.path).filter(Boolean)
  if (paths.length > 0) {
    await supabase.storage.from('customer-photos').remove(paths)
  }

  const { error } = await supabase
    .from('consultation_requests')
    .delete()
    .eq('id', params.id)
    .eq('business_id', businessId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await logAuditServer({
    businessId, staffId, staffName,
    action: 'delete',
    resource: 'consultation_request',
    resourceId: params.id,
  })

  return NextResponse.json({ ok: true })
}
