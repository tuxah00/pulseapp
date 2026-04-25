import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalConsentRevokeSchema } from '@/lib/schemas'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/consents/revoke' })

/**
 * POST /api/portal/consents/revoke
 *
 * Müşteri rızasını iptal eder. revoked_at şimdiyle set edilir.
 * Cross-tenant koruma: customer_id + business_id zorunlu eşleşme.
 * Audit: consent_change.
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalConsentRevokeSchema)
  if (!parsed.ok) return parsed.response
  const { consentId } = parsed.data

  const admin = createAdminClient()

  // Mevcut rıza kaydını sahiplikle birlikte çek
  const { data: existing } = await admin
    .from('consent_records')
    .select('id, consent_type, revoked_at')
    .eq('id', consentId)
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .single()

  if (!existing) {
    return NextResponse.json({ error: 'Onay kaydı bulunamadı' }, { status: 404 })
  }

  if (existing.revoked_at) {
    return NextResponse.json({ error: 'Bu onay zaten iptal edilmiş' }, { status: 409 })
  }

  const { error } = await admin
    .from('consent_records')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', consentId)

  if (error) {
    log.error({ err: error, consentId, businessId, customerId }, 'Onay iptal edilemedi')
    return NextResponse.json({ error: 'Onay iptal edilemedi' }, { status: 500 })
  }

  await logPortalAction({
    customerId,
    businessId,
    action: 'consent_change',
    resource: 'consent_record',
    resourceId: consentId,
    details: { consentType: existing.consent_type, change: 'revoked' },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ ok: true })
}
