import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { createLogger } from '@/lib/utils/logger'
import { patchBusinessSettings } from '@/lib/onboarding/wizard-progress'

const log = createLogger({ route: 'api/onboarding/wizard/staff-tags' })

/**
 * Kurulum sihirbazı Adım 2 — Personel Etiketleri commit endpoint'i.
 *
 * Seçilen etiketleri `businesses.settings.staff_tag_options` JSONB array'e
 * yazar ve `wizard_step` değerini 2'ye günceller.
 *
 * Etiketler personel formundaki "Etiketler" multi-select dropdown'unun
 * seçenek havuzu olarak kullanılır.
 */

const BodySchema = z.object({
  tags: z.array(z.string().trim().min(1).max(40)).max(20),
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

  // Mükerrer kayıtları temizle (case-insensitive), kullanıcı sırasını koru
  const seen = new Set<string>()
  const uniqueTags: string[] = []
  for (const t of parsed.data.tags) {
    const lower = t.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      uniqueTags.push(t)
    }
  }

  try {
    await patchBusinessSettings(
      supabase,
      staff.business_id,
      { staff_tag_options: uniqueTags },
      2,
    )
  } catch (err) {
    log.error({ err }, 'Etiket havuzu yazma hatası')
    return NextResponse.json({ error: 'Etiketler kaydedilemedi' }, { status: 500 })
  }

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'update',
    resource: 'settings',
    details: { source: 'wizard', staff_tag_options: uniqueTags },
  })

  return NextResponse.json({ ok: true, inserted: uniqueTags.length })
}
