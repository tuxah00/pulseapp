import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — Tetikleyici olayı geldiğinde iş akışlarını başlat
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'appointments')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json()
  const { triggerType, customerId, appointmentId } = body

  if (!triggerType || !customerId) {
    return NextResponse.json({ error: 'triggerType ve customerId zorunludur' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Bu işletme için ilgili tetikleyiciye sahip aktif akışları bul
  const { data: workflows, error } = await admin
    .from('workflows')
    .select('id, steps')
    .eq('business_id', businessId)
    .eq('trigger_type', triggerType)
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!workflows || workflows.length === 0) {
    return NextResponse.json({ started: 0 })
  }

  // Her akış için bir run kaydı oluştur
  const runsToInsert = []
  for (const wf of workflows) {
    const steps = wf.steps as { delay_hours: number; message: string }[]
    if (!steps || steps.length === 0) continue

    const firstStepDelay = steps[0].delay_hours || 0
    const nextRunAt = new Date(Date.now() + firstStepDelay * 60 * 60 * 1000).toISOString()

    runsToInsert.push({
      business_id: businessId,
      workflow_id: wf.id,
      customer_id: customerId,
      appointment_id: appointmentId || null,
      current_step: 0,
      status: 'running',
      next_run_at: nextRunAt,
      context: { triggerType, appointmentId },
    })
  }

  if (runsToInsert.length > 0) {
    const { error: insertError } = await admin
      .from('workflow_runs')
      .insert(runsToInsert)

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ started: runsToInsert.length })
}
