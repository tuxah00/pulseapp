import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint, kullanıcı session'ı yok — businessId filtresi cross-tenant korumasını sağlar
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

const supabase = createAdminClient()

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const { data: business, error } = await supabase
    .from('businesses')
    .select('id, name, sector, phone, address, city, district, working_hours, google_maps_url')
    .eq('id', params.id)
    .eq('is_active', true)
    .single()

  if (error || !business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({ business })
}
