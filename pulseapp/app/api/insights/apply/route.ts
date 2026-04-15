import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPendingAction } from '@/lib/ai/assistant-actions'
import type { PendingActionType } from '@/lib/ai/assistant-actions'

const VALID_TYPES: PendingActionType[] = [
  'create_campaign',
  'send_message',
  'create_workflow',
  'update_service',
  'create_blocked_slot',
]

// POST: İş Zekası önerisini pending action kuyruğuna düşürür
// Body: { recommendationId, title, type, payload }
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || !body.type || !body.payload) {
    return NextResponse.json({ error: 'type ve payload zorunlu' }, { status: 400 })
  }

  if (!VALID_TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `Desteklenmeyen aksiyon tipi: ${body.type}` },
      { status: 400 },
    )
  }

  const requiredPerm = PERM_BY_TYPE[body.type as PendingActionType]
  if (requiredPerm && !auth.ctx.permissions[requiredPerm]) {
    return NextResponse.json(
      { error: `Bu aksiyon için ${requiredPerm} yetkisi gerekli` },
      { status: 403 },
    )
  }

  const preview = String(body.title || 'İş Zekası önerisi').slice(0, 200)
  const admin = createAdminClient()

  const result = await createPendingAction(
    admin,
    { ...auth.ctx, conversationId: null },
    body.type as PendingActionType,
    body.payload,
    preview,
    { source: 'insights', recommendation_id: body.recommendationId || null },
  )

  if ('success' in result && result.success === false) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: result })
}

const PERM_BY_TYPE: Partial<Record<PendingActionType, keyof import('@/types').StaffPermissions>> = {
  create_campaign: 'campaigns',
  send_message: 'messages',
  create_workflow: 'messages',
  update_service: 'services',
  create_blocked_slot: 'appointments',
}
