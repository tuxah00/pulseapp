import { NextRequest, NextResponse } from 'next/server'
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
