import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

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
