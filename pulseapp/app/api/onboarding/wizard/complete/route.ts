import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { resolveActiveStaffForApi } from '@/lib/auth/active-business'
import { logAuditServer } from '@/lib/utils/audit'
import { patchBusinessSettings } from '@/lib/onboarding/wizard-progress'

/**
 * Kurulum sihirbazı tamamlama endpoint'i.
 *
 * `businesses.settings.wizard_completed = true` işaretler. Bu noktadan sonra
 * `/onboarding` layout guard'ı kullanıcıyı dashboard'a yönlendirir; sihirbaz
 * bir daha gösterilmez.
 */

export async function POST(_req: NextRequest) {
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

  await patchBusinessSettings(
    supabase,
    staff.business_id,
    { wizard_completed: true },
    5,
  )

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name ?? null,
    action: 'update',
    resource: 'settings',
    details: { source: 'wizard', completed: true },
  })

  return NextResponse.json({ ok: true })
}
