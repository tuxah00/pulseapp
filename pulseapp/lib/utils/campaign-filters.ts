import type { CampaignSegmentFilter } from '@/types'

const MS_PER_DAY = 86400000

type CustomerRow = {
  last_visit_at?: string | null
  birthday?: string | null
  total_visits?: number | null
  total_revenue?: number | null
  created_at: string
}

export function matchesCampaignFilter(c: CustomerRow, filter: CampaignSegmentFilter, now: Date): boolean {
  if (filter.lastVisitDaysMin !== undefined && filter.lastVisitDaysMin > 0) {
    if (!c.last_visit_at) return false
    const days = Math.floor((now.getTime() - new Date(c.last_visit_at).getTime()) / MS_PER_DAY)
    if (days < filter.lastVisitDaysMin) return false
  }
  if (filter.lastVisitDaysMax !== undefined && filter.lastVisitDaysMax > 0) {
    if (!c.last_visit_at) return false
    const days = Math.floor((now.getTime() - new Date(c.last_visit_at).getTime()) / MS_PER_DAY)
    if (days > filter.lastVisitDaysMax) return false
  }
  if (filter.birthdayMonth !== undefined) {
    if (!c.birthday) return false
    if (new Date(c.birthday).getMonth() + 1 !== filter.birthdayMonth) return false
  }
  if (filter.minTotalVisits !== undefined && (c.total_visits || 0) < filter.minTotalVisits) return false
  if (filter.minTotalRevenue !== undefined && (c.total_revenue || 0) < filter.minTotalRevenue) return false
  if (filter.createdDaysAgoMax !== undefined) {
    const days = Math.floor((now.getTime() - new Date(c.created_at).getTime()) / MS_PER_DAY)
    if (days > filter.createdDaysAgoMax) return false
  }
  return true
}
