import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { CampaignSegmentFilter, CustomerSegment } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const segments = (sp.get('segments')?.split(',').filter(Boolean) || []) as CustomerSegment[]
  const lastVisitDaysMin = sp.get('lastVisitDaysMin') ? Number(sp.get('lastVisitDaysMin')) : undefined
  const lastVisitDaysMax = sp.get('lastVisitDaysMax') ? Number(sp.get('lastVisitDaysMax')) : undefined
  const birthdayMonth = sp.get('birthdayMonth') ? Number(sp.get('birthdayMonth')) : undefined
  const minTotalVisits = sp.get('minTotalVisits') ? Number(sp.get('minTotalVisits')) : undefined
  const minTotalRevenue = sp.get('minTotalRevenue') ? Number(sp.get('minTotalRevenue')) : undefined
  const createdDaysAgoMax = sp.get('createdDaysAgoMax') ? Number(sp.get('createdDaysAgoMax')) : undefined

  let query = supabase
    .from('customers')
    .select('id, segment, last_visit_at, total_visits, total_revenue, created_at, birthday')
    .eq('business_id', staff.business_id)
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (segments.length) {
    query = query.in('segment', segments)
  }

  const { data: customers } = await query

  const now = new Date()
  const filter: CampaignSegmentFilter = {
    segments: segments.length ? segments : undefined,
    lastVisitDaysMin,
    lastVisitDaysMax,
    birthdayMonth,
    minTotalVisits,
    minTotalRevenue,
    createdDaysAgoMax,
  }

  const filtered = (customers || []).filter(c => {
    if (filter.lastVisitDaysMin !== undefined && filter.lastVisitDaysMin > 0) {
      if (!c.last_visit_at) return false
      const days = Math.floor((now.getTime() - new Date(c.last_visit_at).getTime()) / 86400000)
      if (days < filter.lastVisitDaysMin) return false
    }
    if (filter.lastVisitDaysMax !== undefined && filter.lastVisitDaysMax > 0) {
      if (!c.last_visit_at) return false
      const days = Math.floor((now.getTime() - new Date(c.last_visit_at).getTime()) / 86400000)
      if (days > filter.lastVisitDaysMax) return false
    }
    if (filter.birthdayMonth !== undefined) {
      if (!c.birthday) return false
      if (new Date(c.birthday).getMonth() + 1 !== filter.birthdayMonth) return false
    }
    if (filter.minTotalVisits !== undefined && (c.total_visits || 0) < filter.minTotalVisits) return false
    if (filter.minTotalRevenue !== undefined && (c.total_revenue || 0) < filter.minTotalRevenue) return false
    if (filter.createdDaysAgoMax !== undefined) {
      const days = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / 86400000)
      if (days > filter.createdDaysAgoMax) return false
    }
    return true
  })

  return NextResponse.json({ count: filtered.length })
}
