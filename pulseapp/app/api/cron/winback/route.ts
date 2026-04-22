import { NextRequest, NextResponse } from 'next/server'
// RLS bypass: arka plan görevi, aktif kullanıcı session'ı yok
import { createAdminClient } from '@/lib/supabase/admin'
import type { CustomerSegment } from '@/types'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/winback' })

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const supabase = createAdminClient()
  const now = new Date()
  const results = { segmentsUpdated: 0, errors: 0 }

  const { data: businesses } = await supabase
    .from('businesses')
    .select('id, name, settings')
    .eq('is_active', true)

  for (const business of businesses || []) {
    const winbackDays: number = business.settings?.winback_days ?? 60

    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone, total_visits, last_visit_at, segment')
      .eq('business_id', business.id)
      .eq('is_active', true)

    for (const customer of customers || []) {
      const visits = customer.total_visits ?? 0
      const lastVisit = customer.last_visit_at ? new Date(customer.last_visit_at) : null

      let newSegment: CustomerSegment
      if (visits === 0) {
        newSegment = 'new'
      } else if (visits < 5) {
        newSegment = 'regular'
      } else {
        newSegment = 'vip'
      }

      if (lastVisit) {
        const daysSince = Math.floor((now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
        if (daysSince >= winbackDays * 2) {
          newSegment = 'lost'
        } else if (daysSince >= winbackDays) {
          newSegment = 'risk'
        }
      }

      if (newSegment === customer.segment) continue

      try {
        await supabase
          .from('customers')
          .update({ segment: newSegment })
          .eq('id', customer.id)
        results.segmentsUpdated++
      } catch (err) {
        results.errors++
        log.error({ err, customerId: customer.id }, 'Segment güncelleme hatası')
      }
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
