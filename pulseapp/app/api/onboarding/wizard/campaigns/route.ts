import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { createLogger } from '@/lib/utils/logger'
import { advanceWizardStep } from '@/lib/onboarding/wizard-progress'

const log = createLogger({ route: 'api/onboarding/wizard/campaigns' })

/**
 * Kurulum sihirbazı Adım 5 — Kampanyalar commit endpoint'i.
 *
 * Seçilen kampanya şablonlarını `campaigns` tablosuna `status='draft'` olarak
 * yazar. Kullanıcı dashboard'daki kampanya yöneticisinden zamanlayıp gönderir.
 */

const SegmentSchema = z.enum(['new', 'regular', 'vip', 'risk', 'lost'])

const CampaignDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  discountPercent: z.number().int().min(0).max(100).nullable().optional(),
  targetSegments: z.array(SegmentSchema).nullable().optional(),
  messageTemplate: z.string().trim().min(1).max(500),
})

const BodySchema = z.object({
  campaigns: z.array(CampaignDraftSchema).max(10),
})

export async function POST(req: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { staff } = await resolveActiveStaffForApi(
    supabase,
    user.id,
    'id, name, business_id, role, is_active'
  )
  if (!staff) {
    return NextResponse.json({ error: 'Aktif işletme bulunamadı' }, { status: 403 })
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Geçersiz veri', details: parsed.error.issues }, { status: 400 })
  }

  const { campaigns } = parsed.data

  if (campaigns.length === 0) {
    await advanceWizardStep(supabase, staff.business_id, 5)
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const rows = campaigns.map(c => ({
    business_id: staff.business_id,
    name: c.name,
    description: c.description ?? null,
    segment_filter: c.targetSegments && c.targetSegments.length > 0
      ? { segments: c.targetSegments }
      : {},
    message_template: c.messageTemplate,
    channel: 'auto' as const,
    status: 'draft' as const,
    created_by_staff_id: staff.id,
  }))

  const { error } = await supabase.from('campaigns').insert(rows)
  if (error) {
    log.error({ err: error }, 'Kampanya ekleme hatası')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await advanceWizardStep(supabase, staff.business_id, 5)

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'create',
    resource: 'campaign',
    details: { source: 'wizard', count: rows.length },
  })

  return NextResponse.json({ ok: true, inserted: rows.length })
}
