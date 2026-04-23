import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { patchBusinessSettings } from '@/lib/onboarding/wizard-progress'

/**
 * Kurulum sihirbazı Adım 3 — Otomatik mesaj akışları commit endpoint'i.
 *
 * Toggle durumlarını ve özelleştirilmiş metin şablonlarını
 * `businesses.settings` JSONB altına merge eder. İlgili cron/otomasyonlar
 * bu bayrakları okur (reminder_24h, reminder_2h, auto_review_request,
 * follow_up_24h_enabled, birthday_sms_enabled, winback_days).
 */

const BodySchema = z.object({
  enabled: z.object({
    reminder_24h: z.boolean(),
    reminder_2h: z.boolean(),
    auto_review_request: z.boolean(),
    follow_up_24h: z.boolean(),
    winback: z.boolean(),
    birthday: z.boolean(),
  }),
  templates: z.object({
    reminder_24h: z.string().max(500).optional(),
    reminder_2h: z.string().max(500).optional(),
    auto_review_request: z.string().max(500).optional(),
    follow_up_24h: z.string().max(500).optional(),
    winback: z.string().max(500).optional(),
    birthday: z.string().max(500).optional(),
  }),
  winbackDays: z.number().int().min(7).max(365),
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

  const { enabled, templates, winbackDays } = parsed.data

  // Settings JSONB'ye merge edilecek patch
  const patch: Record<string, unknown> = {
    reminder_24h: enabled.reminder_24h,
    reminder_2h: enabled.reminder_2h,
    auto_review_request: enabled.auto_review_request,
    follow_up_24h_enabled: enabled.follow_up_24h,
    birthday_sms_enabled: enabled.birthday,
    winback_days: enabled.winback ? winbackDays : 0,
    message_templates: {
      reminder_24h: templates.reminder_24h,
      reminder_2h: templates.reminder_2h,
      review_request: templates.auto_review_request,
      follow_up_24h: templates.follow_up_24h,
      winback: templates.winback,
      birthday: templates.birthday,
    },
  }

  await patchBusinessSettings(supabase, staff.business_id, patch, 3)

  const enabledCount = Object.values(enabled).filter(Boolean).length

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'update',
    resource: 'settings',
    details: { source: 'wizard', section: 'workflows', enabled_count: enabledCount },
  })

  return NextResponse.json({ ok: true, inserted: enabledCount })
}
