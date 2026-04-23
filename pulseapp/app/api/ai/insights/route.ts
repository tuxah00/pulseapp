import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  // Staff membership kontrolü
  const { data: staff } = await supabase
    .from('staff_members')
    .select('id')
    .eq('business_id', businessId)
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })

  const admin = createAdminClient()
  const { data: insights, error } = await admin
    .from('ai_insights')
    .select('*')
    .eq('business_id', businessId)
    .in('status', ['new', 'viewed'])
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // new olanları viewed yap (görüntülendi)
  const newIds = (insights ?? []).filter(i => i.status === 'new').map(i => i.id)
  if (newIds.length > 0) {
    await admin
      .from('ai_insights')
      .update({ status: 'viewed' })
      .in('id', newIds)
  }

  const newCount = newIds.length
  return NextResponse.json({ insights, new_count: newCount })
}
