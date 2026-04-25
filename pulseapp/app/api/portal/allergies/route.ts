import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

/**
 * GET /api/portal/allergies
 *
 * Müşterinin kendi alerji kayıtları (read-only).
 * Sadece estetik+diş klinik müşterileri portal'da görür; UI tarafında sektör filtresi
 * yapılır. Endpoint kendi içinde sektör kontrolü YAPMAZ — RLS yok, salon ekleyince görünür.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customer_allergies')
    .select('id, allergen, severity, reaction, notes, created_at')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Alerji kayıtları yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ allergies: data || [] })
}
