import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
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
