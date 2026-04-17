import { NextRequest, NextResponse } from 'next/server'
import { requirePortalSession } from '@/lib/portal/guards'
import { getCustomerVisibleRecords } from '@/lib/portal/queries'

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const { data, error } = await getCustomerVisibleRecords(businessId, customerId)
  if (error) {
    return NextResponse.json({ error: 'Kayıtlar alınamadı' }, { status: 500 })
  }

  return NextResponse.json({ records: data || [] })
}
