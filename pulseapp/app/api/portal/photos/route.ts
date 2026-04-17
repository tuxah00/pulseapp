import { NextRequest, NextResponse } from 'next/server'
import { requirePortalSession } from '@/lib/portal/guards'
import { getCustomerVisiblePhotos } from '@/lib/portal/queries'

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const { data, error } = await getCustomerVisiblePhotos(businessId, customerId)
  if (error) {
    return NextResponse.json({ error: 'Fotoğraflar alınamadı' }, { status: 500 })
  }

  return NextResponse.json({ photos: data || [] })
}
