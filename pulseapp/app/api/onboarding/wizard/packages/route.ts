import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { createLogger } from '@/lib/utils/logger'
import { advanceWizardStep } from '@/lib/onboarding/wizard-progress'

const log = createLogger({ route: 'api/onboarding/wizard/packages' })

/**
 * Kurulum sihirbazı Adım 2 — Seans paketleri commit endpoint'i.
 *
 * Seçilen/özelleştirilen paketleri `service_packages` tablosuna insert eder
 * ve `wizard_step = 2` olarak işaretler.
 *
 * Not: Paketler isteğe bağlı olarak bir servise `service_id` FK ile bağlanabilir;
 * ancak wizard'da kullanıcı hangi servise bağlı olduğunu seçmediği için null bırakıyoruz.
 * Kullanıcı sonradan `/dashboard/settings/packages` üzerinden düzenleyebilir.
 */

const PackageDraftSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(500).nullable().optional(),
  sessions_total: z.number().int().min(1).max(50),
  price: z.number().min(0).max(1_000_000),
  validity_days: z.number().int().min(1).max(3650).nullable().optional(),
})

const BodySchema = z.object({
  packages: z.array(PackageDraftSchema).max(20),
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

  const { packages } = parsed.data

  if (packages.length === 0) {
    await advanceWizardStep(supabase, staff.business_id, 2)
    return NextResponse.json({ ok: true, inserted: 0 })
  }

  const { data: maxRow } = await supabase
    .from('service_packages')
    .select('sort_order')
    .eq('business_id', staff.business_id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()
  const baseSort = (maxRow?.sort_order ?? -1) + 1

  const rows = packages.map((p, i) => ({
    business_id: staff.business_id,
    name: p.name,
    description: p.description ?? null,
    service_id: null,
    sessions_total: p.sessions_total,
    price: p.price,
    validity_days: p.validity_days ?? null,
    sort_order: baseSort + i,
    is_active: true,
  }))

  const { error } = await supabase.from('service_packages').insert(rows)
  if (error) {
    log.error({ err: error }, 'Paket ekleme hatası')
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  await advanceWizardStep(supabase, staff.business_id, 2)

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'create',
    resource: 'service_package',
    details: { source: 'wizard', count: rows.length },
  })

  return NextResponse.json({ ok: true, inserted: rows.length })
}
