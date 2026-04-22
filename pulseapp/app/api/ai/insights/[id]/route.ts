import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { status } = body  // 'dismissed' | 'acted'

  if (!['dismissed', 'acted'].includes(status)) {
    return NextResponse.json({ error: 'Geçersiz status' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Insight'ın bu kullanıcının business'ına ait olduğunu kontrol et
  const { data: insight } = await admin
    .from('ai_insights')
    .select('id, business_id')
    .eq('id', params.id)
    .single()

  if (!insight) return NextResponse.json({ error: 'Bulunamadı' }, { status: 404 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('business_id', insight.business_id)
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const { error } = await admin
    .from('ai_insights')
    .update({ status })
    .eq('id', params.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
