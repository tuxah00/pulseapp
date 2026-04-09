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
