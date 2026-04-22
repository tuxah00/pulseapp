import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { executePendingAction, cancelPendingAction } from '@/lib/ai/assistant-actions'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { aiActionConfirmSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/ai/assistant/confirm' })

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

  const parsed = await validateBody(req, aiActionConfirmSchema)
  if (!parsed.ok) return parsed.response
  const { action_id, decision } = parsed.data

  if (decision === 'cancel') {
    const res = await cancelPendingAction(admin, action_id, staff.id)
    return NextResponse.json(res)
  }

  try {
    const result = await executePendingAction(admin, action_id, {
      staffId: staff.id,
      businessId: staff.business_id,
      staffName: staff.name,
    })
    return NextResponse.json(result)
  } catch (err) {
    log.error({ err, action_id }, 'AI aksiyon yürütme hatası')
    return NextResponse.json({ error: 'Aksiyon yürütülemedi' }, { status: 500 })
  }
}
