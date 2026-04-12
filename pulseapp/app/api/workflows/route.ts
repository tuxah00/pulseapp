import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'

// GET — İş akışlarını listele
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'messages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const admin = createAdminClient()

  // Get workflows with run count for this month
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data: workflows, error } = await admin
    .from('workflows')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get run counts for this month
  const { data: runCounts } = await admin
    .from('workflow_runs')
    .select('workflow_id')
    .eq('business_id', businessId)
    .gte('started_at', monthStart)

  const runCountMap = new Map<string, number>()
  for (const run of runCounts || []) {
    runCountMap.set(run.workflow_id, (runCountMap.get(run.workflow_id) || 0) + 1)
  }

  const result = (workflows || []).map(w => ({
    ...w,
    runs_this_month: runCountMap.get(w.id) || 0,
  }))

  const totalRunsThisMonth = (runCounts || []).length

  return NextResponse.json({ workflows: result, totalRunsThisMonth })
}

// POST — Yeni iş akışı oluştur
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'messages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json()
  const { name, triggerType, steps } = body

  if (!name || !triggerType || !steps || !Array.isArray(steps) || steps.length === 0) {
    return NextResponse.json({ error: 'Ad, tetikleyici türü ve en az bir adım zorunludur' }, { status: 400 })
  }

  const validTriggers = ['appointment_completed', 'appointment_cancelled', 'customer_created', 'no_show', 'birthday']
  if (!validTriggers.includes(triggerType)) {
    return NextResponse.json({ error: 'Geçersiz tetikleyici türü' }, { status: 400 })
  }

  // Validate steps
  for (const step of steps) {
    if (typeof step.delay_hours !== 'number' || step.delay_hours < 0) {
      return NextResponse.json({ error: 'Her adımda geçerli bir bekleme süresi (saat) zorunludur' }, { status: 400 })
    }
    if (!step.message || typeof step.message !== 'string') {
      return NextResponse.json({ error: 'Her adımda mesaj zorunludur' }, { status: 400 })
    }
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('workflows')
    .insert({
      business_id: businessId,
      name,
      trigger_type: triggerType,
      steps,
      is_active: true,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ workflow: data }, { status: 201 })
}

// PATCH — İş akışını güncelle (?id=)
export async function PATCH(request: NextRequest) {
  const auth = await requirePermission(request, 'messages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 })

  const body = await request.json()
  const { name, isActive, steps } = body

  const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (name !== undefined) updateData.name = name
  if (isActive !== undefined) updateData.is_active = isActive
  if (steps !== undefined) {
    if (!Array.isArray(steps) || steps.length === 0) {
      return NextResponse.json({ error: 'En az bir adım zorunludur' }, { status: 400 })
    }
    updateData.steps = steps
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('workflows')
    .update(updateData)
    .eq('id', id)
    .eq('business_id', businessId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ workflow: data })
}

// DELETE — İş akışını sil (?id=)
export async function DELETE(request: NextRequest) {
  const auth = await requirePermission(request, 'messages')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id zorunludur' }, { status: 400 })

  const admin = createAdminClient()

  const { error } = await admin
    .from('workflows')
    .delete()
    .eq('id', id)
    .eq('business_id', businessId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
