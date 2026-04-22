import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { aiTutorialProgressSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'
import type { TutorialProgress } from '@/types'

const log = createLogger({ route: 'api/ai/tutorial-progress' })

export const runtime = 'nodejs'

async function getStaffRow() {
  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: 'auth' as const }

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff_members')
    .select('id, business_id, tutorial_progress')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!staff) return { error: 'no_staff' as const }
  return { admin, staff }
}

export async function GET(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.general)
  if (rl.limited) return rl.response

  const res = await getStaffRow()
  if ('error' in res) {
    const status = res.error === 'auth' ? 401 : 403
    return Response.json({ error: res.error }, { status })
  }

  const progress = (res.staff.tutorial_progress as TutorialProgress) || {}
  const normalized: TutorialProgress = {
    enabled: progress.enabled ?? true,
    setup_completed_at: progress.setup_completed_at ?? null,
    seen_pages: progress.seen_pages ?? [],
    dismissed_at: progress.dismissed_at ?? null,
  }
  return Response.json({ progress: normalized })
}

export async function PATCH(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.general)
  if (rl.limited) return rl.response

  const res = await getStaffRow()
  if ('error' in res) {
    const status = res.error === 'auth' ? 401 : 403
    return Response.json({ error: res.error }, { status })
  }

  const parsed = await validateBody(req, aiTutorialProgressSchema)
  if (!parsed.ok) return parsed.response
  const { enabled, setup_completed_at, dismissed_at, seen_pages, resetSeen } = parsed.data

  const current = (res.staff.tutorial_progress as TutorialProgress) || {}
  const merged: TutorialProgress = { ...current }

  if (typeof enabled === 'boolean') merged.enabled = enabled
  if (setup_completed_at !== undefined) merged.setup_completed_at = setup_completed_at
  if (dismissed_at !== undefined) merged.dismissed_at = dismissed_at

  if (Array.isArray(seen_pages)) {
    merged.seen_pages = seen_pages
  } else if (resetSeen) {
    merged.seen_pages = []
    merged.setup_completed_at = null
  }

  const { error: upErr } = await res.admin
    .from('staff_members')
    .update({ tutorial_progress: merged })
    .eq('id', res.staff.id)

  if (upErr) {
    log.error({ err: upErr, staffId: res.staff.id }, 'Tutorial progress güncellenemedi')
    return Response.json({ error: upErr.message }, { status: 500 })
  }

  return Response.json({ progress: merged })
}
