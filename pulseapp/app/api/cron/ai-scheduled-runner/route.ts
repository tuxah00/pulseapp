import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: arka plan görevi, aktif kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { executePendingAction } from '@/lib/ai/assistant-actions'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/ai-scheduled-runner' })

export const runtime = 'nodejs'
export const maxDuration = 60

const BATCH_LIMIT = 50

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const nowIso = new Date().toISOString()

  // 1) Find due scheduled actions.
  const { data: due, error } = await admin
    .from('ai_pending_actions')
    .select('id, business_id, staff_id')
    .eq('status', 'scheduled')
    .lte('scheduled_for', nowIso)
    .order('scheduled_for', { ascending: true })
    .limit(BATCH_LIMIT)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, total: 0, executed: 0, failed: 0, results: [] })
  }

  // 2) Batch-load staff names (avoid N+1).
  const staffIds = Array.from(new Set(due.map((a) => a.staff_id).filter(Boolean)))
  const { data: staffRows } = await admin
    .from('staff_members')
    .select('id, name')
    .in('id', staffIds)
  const staffMap = new Map<string, string>()
  for (const s of staffRows || []) staffMap.set(s.id, s.name || 'AI Asistan')

  // 3) Execute in parallel. executePendingAction's own status guard + the
  //    scheduled→executed/failed transition prevents double-run.
  const results = await Promise.all(due.map(async (action) => {
    const ctx = {
      businessId: action.business_id,
      staffId: action.staff_id,
      staffName: staffMap.get(action.staff_id) || 'AI Asistan',
    }
    try {
      const res = await executePendingAction(admin, action.id, ctx)
      return { id: action.id, ok: res.ok, message: res.message }
    } catch (err: any) {
      log.error({ err, actionId: action.id }, '[ai-scheduled-runner] action failed')
      await admin
        .from('ai_pending_actions')
        .update({ status: 'failed', result: { ok: false, message: err?.message || 'runner error' } })
        .eq('id', action.id)
      return { id: action.id, ok: false, message: err?.message || 'runner error' }
    }
  }))

  const executed = results.filter((r) => r.ok).length
  const failed = results.length - executed

  return NextResponse.json({ ok: true, total: due.length, executed, failed, results })
}
