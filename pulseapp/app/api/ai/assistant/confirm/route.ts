import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executePendingAction, cancelPendingAction } from '@/lib/ai/assistant-actions'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(req, RATE_LIMITS.aiAssistant)
  if (rl.limited) return rl.response

  const supabase = createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Oturum bulunamadı' }, { status: 401 })
  }

  const admin = createAdminClient()
  const { data: staff } = await admin
    .from('staff_members')
    .select('id, business_id, role, permissions, name, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .single()

  if (!staff) {
    return NextResponse.json({ error: 'Personel kaydı bulunamadı' }, { status: 403 })
  }

  const body = await req.json()
  const { action_id, decision } = body as { action_id: string; decision: 'confirm' | 'cancel' }

  if (!action_id || !['confirm', 'cancel'].includes(decision)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  if (decision === 'cancel') {
    const res = await cancelPendingAction(admin, action_id, staff.id)
    return NextResponse.json(res)
  }

  const result = await executePendingAction(admin, action_id, {
    staffId: staff.id,
    businessId: staff.business_id,
    staffName: staff.name,
  })

  return NextResponse.json(result)
}
