import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

/**
 * GET /api/portal/consents
 *
 * Müşterinin verdiği KVKK, pazarlama, sağlık verisi ve WhatsApp rıza kayıtları.
 * Aktif olanlar (revoked_at IS NULL) önce gelir, sonra iptal edilenler.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('consent_records')
    .select('id, consent_type, given_at, revoked_at, method, notes')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('given_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Onay kayıtları yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ consents: data || [] })
}
