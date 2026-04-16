import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPendingAction } from '@/lib/ai/assistant-actions'
import type { PendingActionType } from '@/lib/ai/assistant-actions'
import type { StaffPermissions } from '@/types'

// İş Zekası "Uygula" akışının izin verdiği aksiyon tipleri → gerekli alt yetki
const INSIGHTS_ALLOWED: Partial<Record<PendingActionType, keyof StaffPermissions>> = {
  create_campaign: 'campaigns',
  send_message: 'messages',
  create_workflow: 'messages',
  update_service: 'services',
  create_blocked_slot: 'appointments',
}

// POST: İş Zekası önerisini pending action kuyruğuna düşürür
// Body: { recommendationId, title, type, payload }
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || !body.type || !body.payload) {
    return NextResponse.json({ error: 'type ve payload zorunlu' }, { status: 400 })
  }

  const type = body.type as PendingActionType
  if (!(type in INSIGHTS_ALLOWED)) {
    return NextResponse.json(
      { error: `Desteklenmeyen aksiyon tipi: ${body.type}` },
      { status: 400 },
    )
  }

  const requiredPerm = INSIGHTS_ALLOWED[type]
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
    type,
    body.payload,
    preview,
    { source: 'insights', recommendation_id: body.recommendationId || null },
    // İş Zekası'ndan gelen aksiyonlar 7 gün boyunca geçerli (asistan kuyruğuyla aynı tablo)
    { expiresInMinutes: 7 * 24 * 60 },
  )

  if ('success' in result && result.success === false) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: result })
}
