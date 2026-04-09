import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const supabase = createAdminClient()

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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
