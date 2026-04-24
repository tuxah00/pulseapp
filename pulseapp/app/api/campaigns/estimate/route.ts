import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getStaffInfo } from '@/lib/campaigns/staff'
import { matchesCampaignFilter } from '@/lib/utils/campaign-filters'
import type { CustomerSegment } from '@/types'

const MS_PER_DAY = 86400000

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const staff = await getStaffInfo(supabase)
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const sp = request.nextUrl.searchParams
  const segments = (sp.get('segments')?.split(',').filter(Boolean) || []) as CustomerSegment[]
  const lastVisitDaysMin = sp.get('lastVisitDaysMin') ? Number(sp.get('lastVisitDaysMin')) : undefined
  const lastVisitDaysMax = sp.get('lastVisitDaysMax') ? Number(sp.get('lastVisitDaysMax')) : undefined
  const birthdayMonth = sp.get('birthdayMonth') ? Number(sp.get('birthdayMonth')) : undefined
  const minTotalVisits = sp.get('minTotalVisits') ? Number(sp.get('minTotalVisits')) : undefined
  const minTotalRevenue = sp.get('minTotalRevenue') ? Number(sp.get('minTotalRevenue')) : undefined
  const createdDaysAgoMax = sp.get('createdDaysAgoMax') ? Number(sp.get('createdDaysAgoMax')) : undefined

  const now = new Date()

  let query = supabase
    .from('customers')
    .select('segment, last_visit_at, total_visits, total_revenue, created_at, birthday')
    .eq('business_id', staff.business_id)
    .eq('is_active', true)
    .not('phone', 'is', null)

  if (segments.length) query = query.in('segment', segments)
  if (lastVisitDaysMin) query = query.lte('last_visit_at', new Date(now.getTime() - lastVisitDaysMin * MS_PER_DAY).toISOString())
  if (lastVisitDaysMax) query = query.gte('last_visit_at', new Date(now.getTime() - lastVisitDaysMax * MS_PER_DAY).toISOString())
  if (minTotalVisits) query = query.gte('total_visits', minTotalVisits)
  if (minTotalRevenue) query = query.gte('total_revenue', minTotalRevenue)
  if (createdDaysAgoMax) query = query.gte('created_at', new Date(now.getTime() - createdDaysAgoMax * MS_PER_DAY).toISOString())

  const { data: customers } = await query

  // birthdayMonth can't be pushed to DB via PostgREST — filter in JS
  const count = birthdayMonth
    ? (customers || []).filter(c => matchesCampaignFilter(c, { birthdayMonth }, now)).length
    : (customers || []).length

  return NextResponse.json({ count })
}
