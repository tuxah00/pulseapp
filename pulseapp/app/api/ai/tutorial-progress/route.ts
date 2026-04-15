import { NextRequest } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { TutorialProgress } from '@/types'

export const runtime = 'nodejs'

async function getStaffRow(req: NextRequest) {
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
  const res = await getStaffRow(req)
  if ('error' in res) {
    const status = res.error === 'auth' ? 401 : 403
    return Response.json({ error: res.error }, { status })
  }

  const progress = (res.staff.tutorial_progress as TutorialProgress) || {}
  // Varsayılan: yeni personel için enabled=true
  const normalized: TutorialProgress = {
    enabled: progress.enabled ?? true,
    setup_completed_at: progress.setup_completed_at ?? null,
    seen_pages: progress.seen_pages ?? [],
    dismissed_at: progress.dismissed_at ?? null,
  }
  return Response.json({ progress: normalized })
}

export async function PATCH(req: NextRequest) {
  const res = await getStaffRow(req)
  if ('error' in res) {
    const status = res.error === 'auth' ? 401 : 403
    return Response.json({ error: res.error }, { status })
  }

  const body = await req.json().catch(() => ({}))
  const incoming = body as Partial<TutorialProgress> & { resetSeen?: boolean }

  const current = (res.staff.tutorial_progress as TutorialProgress) || {}
  const merged: TutorialProgress = { ...current }

  if (typeof incoming.enabled === 'boolean') merged.enabled = incoming.enabled
  if (incoming.setup_completed_at !== undefined) merged.setup_completed_at = incoming.setup_completed_at
  if (incoming.dismissed_at !== undefined) merged.dismissed_at = incoming.dismissed_at

  if (Array.isArray(incoming.seen_pages)) {
    // Tam seti değiştir (sıfırlama için boş dizi gelebilir)
    merged.seen_pages = incoming.seen_pages
  } else if (incoming.resetSeen) {
    merged.seen_pages = []
    merged.setup_completed_at = null
  }

  const { error: upErr } = await res.admin
    .from('staff_members')
    .update({ tutorial_progress: merged })
    .eq('id', res.staff.id)

  if (upErr) {
    return Response.json({ error: upErr.message }, { status: 500 })
  }

  return Response.json({ progress: merged })
}
