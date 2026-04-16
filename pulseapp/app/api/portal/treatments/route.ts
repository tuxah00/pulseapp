import { NextRequest, NextResponse } from 'next/server'
import { requirePortalSession } from '@/lib/portal/guards'
import {
  getActiveProtocolsWithSessions,
  getCustomerPackages,
  getCustomerVisiblePhotos,
} from '@/lib/portal/queries'

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const [protocolsRes, packagesRes, photosRes] = await Promise.all([
    getActiveProtocolsWithSessions(businessId, customerId),
    getCustomerPackages(businessId, customerId),
    getCustomerVisiblePhotos(businessId, customerId),
  ])

  if (protocolsRes.error || packagesRes.error || photosRes.error) {
    return NextResponse.json({ error: 'Tedaviler alınamadı' }, { status: 500 })
  }

  const allPhotos = photosRes.data || []

  // Protokol ID'sine göre fotoğrafları grupla — müşteri öncesi/sonrası galeri için
  const photosByProtocol: Record<string, typeof allPhotos> = {}
  for (const photo of allPhotos) {
    if (photo.protocol_id) {
      if (!photosByProtocol[photo.protocol_id]) {
        photosByProtocol[photo.protocol_id] = []
      }
      photosByProtocol[photo.protocol_id].push(photo)
    }
  }

  const protocols = (protocolsRes.data || []).map((p: any) => ({
    ...p,
    photos: photosByProtocol[p.id] || [],
    sessions: (p.sessions || []).sort(
      (a: any, b: any) => (a.session_number || 0) - (b.session_number || 0)
    ),
  }))

  return NextResponse.json({
    protocols,
    packages: packagesRes.data || [],
  })
}
