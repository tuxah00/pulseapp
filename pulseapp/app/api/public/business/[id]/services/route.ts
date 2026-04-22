import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: public endpoint, kullanıcı session'ı yok — businessId filtresi cross-tenant korumasını sağlar
import { createAdminClient } from '@/lib/supabase/admin'
import { isValidUUID } from '@/lib/utils/validate'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createAdminClient()
  if (!isValidUUID(params.id)) {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const { data: services, error } = await supabase
    .from('services')
    .select('id, name, description, duration_minutes, price')
    .eq('business_id', params.id)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Hizmetler yüklenemedi' }, { status: 500 })
  }

  return NextResponse.json({ services: services || [] })
}
