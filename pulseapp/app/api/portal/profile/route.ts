import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalProfileUpdateSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'

const log = createLogger({ route: 'api/portal/profile' })

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customers')
    .select('id, name, phone, email, birthday, preferred_channel, notes, segment, total_visits')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({ profile: data })
}

export async function PATCH(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalProfileUpdateSchema)
  if (!parsed.ok) return parsed.response

  // Şema zaten allowed alanları filtreler — doğrudan DB'ye yazılabilir
  const updates = parsed.data

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customers')
    .update(updates)
    .eq('id', customerId)
    .eq('business_id', businessId)
    .select('id, name, phone, email, birthday, preferred_channel, segment, total_visits')
    .single()

  if (error) {
    log.error({ err: error }, '[portal/profile] update error')
    return NextResponse.json({ error: 'Profil güncellenemedi' }, { status: 500 })
  }

  await logPortalAction({
    customerId,
    businessId,
    action: 'profile_update',
    resource: 'customer',
    resourceId: customerId,
    details: { fields: Object.keys(updates) },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ profile: data })
}
