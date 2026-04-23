import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { createLogger } from '@/lib/utils/logger'
import { patchBusinessSettings } from '@/lib/onboarding/wizard-progress'

const log = createLogger({ route: 'api/onboarding/wizard/rewards' })

/**
 * Kurulum sihirbazı Adım 4 — Ödüller commit endpoint'i.
 *
 * Seçilen ödül kartlarını `rewards` tablosuna insert eder ve
 * `businesses.settings.rewards_enabled` bayrağını günceller.
 * Toggle kapalı gönderildiğinde yalnızca bayrak false yazılır, insert yok.
 */

const RewardDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  type: z.enum(['discount_percent', 'discount_amount', 'free_service', 'points', 'gift']),
  value: z.number().min(0).max(1_000_000),
  validDays: z.number().int().min(1).max(3650),
})

const BodySchema = z.object({
  enabled: z.boolean(),
  rewards: z.array(RewardDraftSchema).max(10),
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

  const { enabled, rewards } = parsed.data

  let inserted = 0
  if (enabled && rewards.length > 0) {
    const rows = rewards.map(r => ({
      business_id: staff.business_id,
      name: r.name,
      description: r.description ?? null,
      type: r.type,
      value: r.value,
      valid_days: r.validDays,
      is_active: true,
    }))
    const { error } = await supabase.from('rewards').insert(rows)
    if (error) {
      log.error({ err: error }, 'Ödül ekleme hatası')
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    inserted = rows.length
  }

  await patchBusinessSettings(supabase, staff.business_id, { rewards_enabled: enabled }, 4)

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: enabled ? 'create' : 'update',
    resource: 'reward',
    details: { source: 'wizard', enabled, count: inserted },
  })

  return NextResponse.json({ ok: true, inserted })
}
