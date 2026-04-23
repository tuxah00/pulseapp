import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/onboarding/wizard/services' })

/**
 * Kurulum sihirbazı Adım 1 — Hizmetler commit endpoint'i.
 *
 * Seçilen + özelleştirilen hizmet kartlarını `services` tablosuna insert eder
 * ve `businesses.settings.wizard_step` değerini 1'e günceller.
 *
 * Kısmi çıkışta veri kaybı olmaması için her adım kendi içinde tutarlı.
 */

const ServiceDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  duration_minutes: z.number().int().min(5).max(480),
  price: z.number().min(0).max(1_000_000),
  recommended_interval_days: z.number().int().min(1).max(3650).nullable().optional(),
})

const BodySchema = z.object({
  services: z.array(ServiceDraftSchema).max(30),
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

  const { services } = parsed.data

  // Boş gönderim — sadece wizard_step güncelle, insert yok
  if (services.length === 0) {
    await updateWizardStep(supabase, staff.business_id, 1)
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  // Mevcut max sort_order'ı bul (kullanıcı daha önce hizmet eklemiş olabilir)
  const { data: maxRow } = await supabase
    .from('services')
    .select('sort_order')
    .eq('business_id', staff.business_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const baseSort = (maxRow?.sort_order ?? -1) + 1

  const rows = services.map((s, i) => ({
    business_id: staff.business_id,
    name: s.name,
    description: s.description ?? null,
    duration_minutes: s.duration_minutes,
    price: s.price,
    recommended_interval_days: s.recommended_interval_days ?? null,
    sort_order: baseSort + i,
    is_active: true,
  }))

  const { error } = await supabase.from('services').insert(rows)
  if (error) {
    log.error({ err: error }, 'Hizmet ekleme hatası')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await updateWizardStep(supabase, staff.business_id, 1)

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'create',
    resource: 'service',
    details: { source: 'wizard', count: rows.length },
  })

  return NextResponse.json({ ok: true, inserted: rows.length })
}

async function updateWizardStep(
  supabase: ReturnType<typeof createServerSupabaseClient>,
  businessId: string,
  step: number,
) {
  // settings JSONB'ye merge — önce mevcut değeri çek, sonra yaz
  const { data } = await supabase
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .maybeSingle()

  const settings = (data?.settings as Record<string, unknown> | null) ?? {}
  const prevStep = typeof settings.wizard_step === 'number' ? settings.wizard_step : 0
  const nextSettings = { ...settings, wizard_step: Math.max(prevStep, step) }

  await supabase.from('businesses').update({ settings: nextSettings }).eq('id', businessId)
}
