import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { createPendingAction } from '@/lib/ai/assistant-actions'
import type { PendingActionType } from '@/lib/ai/assistant-actions'
import type { InsightActionKind } from '@/lib/insights/types'
import type { StaffPermissions } from '@/types'

/**
 * İş Zekası paneli "Uygula" akışı:
 *   UI → POST /api/insights/apply { kind, payload, title, recommendationId? }
 *   Burası → ai_pending_actions kuyruğuna satır düşürür.
 *
 * `kind` alanı `InsightActionKind` (template motorundaki isim).
 * Bu endpoint kind'ı `PendingActionType`'a eşler — çünkü pending_actions
 * tablosunun CHECK constraint'i o tipleri bekler.
 */

// InsightActionKind → PendingActionType eşlemesi.
// `navigate` UI-only'dir; hiçbir pending action üretmez.
const KIND_MAP: Record<
  Exclude<InsightActionKind, 'navigate'>,
  PendingActionType
> = {
  create_campaign: 'create_campaign',
  // Klon "aynı kampanyayı tekrarla" = yine create_campaign; payload.clone_from dolu gider
  clone_campaign: 'create_campaign',
  // Paket oluştur = bundle/hizmet oluşturma; şu an create_service tipine yaslıyoruz
  create_package: 'create_service',
  create_message_flow: 'create_workflow',
  toggle_message_flow: 'toggle_workflow',
  update_service: 'update_service',
  update_working_hours: 'update_working_hours',
  update_business_settings: 'update_business_settings',
  // Hatırlatma = segment'e/personele mesaj; send_message tipi altında çalışır
  schedule_reminder: 'send_message',
}

// Her PendingActionType için gereken alt yetki (null = ek yetki yok)
const PERMISSION_MAP: Partial<Record<PendingActionType, keyof StaffPermissions>> = {
  create_campaign: 'campaigns',
  send_message: 'messages',
  create_workflow: 'messages',
  toggle_workflow: 'messages',
  update_service: 'services',
  create_service: 'services',
  create_blocked_slot: 'appointments',
  update_working_hours: 'settings',
  update_business_settings: 'settings',
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  // Eski (type) ve yeni (kind) alan adlarını birlikte destekle — geriye dönük uyum
  const rawKind = (body.kind ?? body.type) as InsightActionKind | undefined
  const payload = body.payload as Record<string, unknown> | undefined

  if (!rawKind || !payload) {
    return NextResponse.json({ error: 'kind ve payload zorunlu' }, { status: 400 })
  }

  if (rawKind === 'navigate') {
    return NextResponse.json(
      { error: 'navigate aksiyonu pending action üretmez' },
      { status: 400 },
    )
  }

  const mappedType = KIND_MAP[rawKind as Exclude<InsightActionKind, 'navigate'>]
  if (!mappedType) {
    return NextResponse.json(
      { error: `Desteklenmeyen aksiyon: ${rawKind}` },
      { status: 400 },
    )
  }

  const requiredPerm = PERMISSION_MAP[mappedType]
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
    mappedType,
    payload,
    preview,
    {
      source: 'insights',
      kind: rawKind, // İz sürme için orijinal insight kind'ı
      recommendation_id: body.recommendationId || null,
      template_key: body.templateKey || null,
    },
    // İş Zekası önerileri 7 gün boyunca kuyrukta kalır
    { expiresInMinutes: 7 * 24 * 60 },
  )

  if ('success' in result && result.success === false) {
    return NextResponse.json({ error: result.error }, { status: 500 })
  }

  return NextResponse.json({ success: true, action: result })
}
