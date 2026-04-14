import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { sanitizeOrFilter } from '@/lib/utils/validate'

async function verifyMembership(supabase: ReturnType<typeof createServerSupabaseClient>, userId: string, businessId: string) {
  const { data } = await supabase
    .from('staff_members')
    .select('id')
    .eq('user_id', userId)
    .eq('business_id', businessId)
    .single()
  return data
}

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get('businessId')
  const q = searchParams.get('q')?.trim() || ''
  const limitParam = Math.min(Number(searchParams.get('limit') || 10), 25)
  const selectedId = searchParams.get('selectedId')

  if (!businessId) return NextResponse.json({ error: 'businessId gerekli' }, { status: 400 })

  const staff = await verifyMembership(supabase, user.id, businessId)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 403 })

  let query = supabase
    .from('customers')
    .select('id, name, phone')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (q) {
    const safeQ = sanitizeOrFilter(q)
    if (safeQ) {
      query = query.or(`name.ilike.%${safeQ}%,phone.ilike.%${safeQ}%`)
    }
    query = query.order('name').limit(limitParam)
  } else {
    query = query.order('last_visit_at', { ascending: false, nullsFirst: false })
    query = query.limit(limitParam)
  }

  const { data: customers, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // selectedId varsa ve sonuçlarda yoksa ayrı fetch et
  if (selectedId && !customers?.find(c => c.id === selectedId)) {
    const { data: selected } = await supabase
      .from('customers')
      .select('id, name, phone')
      .eq('id', selectedId)
      .eq('business_id', businessId)
      .eq('is_active', true)
      .single()

    if (selected) {
      customers?.unshift(selected)
    }
  }

  return NextResponse.json({ customers: customers || [] })
}
