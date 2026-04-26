import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint, kullanıcı session'ı yok — businessId filtresi cross-tenant korumasını sağlar
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const serviceId = req.nextUrl.searchParams.get('serviceId')

  // serviceId verilmişse: yalnızca o hizmeti yapabilen personeli döndür
  if (serviceId && isValidUUID(serviceId)) {
    // staff_services'ten bu hizmeti yapabilen staff_id'leri çek
    const { data: stsRows } = await supabase
      .from('staff_services')
      .select('staff_id')
      .eq('business_id', params.id)
      .eq('service_id', serviceId)

    const eligibleIds = (stsRows ?? []).map(r => r.staff_id)

    if (eligibleIds.length === 0) {
      // Hiçbir personel bu hizmeti yapamıyor → boş dön
      return NextResponse.json({ staff: [] })
    }

    const { data: staff, error } = await supabase
      .from('staff_members')
      .select('id, name, avatar_url')
      .eq('business_id', params.id)
      .eq('is_active', true)
      .in('id', eligibleIds)
      .order('name', { ascending: true })

    if (error) return NextResponse.json({ error: 'Personel yüklenemedi' }, { status: 500 })
    return NextResponse.json({ staff: staff || [] })
  }

  // serviceId yok → tüm aktif personeli döndür
  const { data: staff, error } = await supabase
    .from('staff_members')
    .select('id, name, avatar_url')
    .eq('business_id', params.id)
    .eq('is_active', true)
    .order('name', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Personel yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ staff: staff || [] })
}
