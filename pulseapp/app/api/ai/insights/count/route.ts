import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ count: 0 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  if (!businessId) return NextResponse.json({ count: 0 })

  const admin = createAdminClient()
  const { count } = await admin
    .from('ai_insights')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'new')
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())

  return NextResponse.json({ count: count ?? 0 })
}
