// app/api/consultations/route.ts
// Dashboard: ön konsültasyon listesi — GET

import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'consultations')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const url = req.nextUrl
  const status = url.searchParams.get('status') || ''
  const search = url.searchParams.get('search') || ''
  const from = url.searchParams.get('from') || ''
  const to = url.searchParams.get('to') || ''
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50'), 100)
  const offset = parseInt(url.searchParams.get('offset') || '0')

  const supabase = createAdminClient()

  let query = supabase
    .from('consultation_requests')
    .select(`
      *,
      service:services(name)
    `, { count: 'exact' })
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', to + 'T23:59:59')
  if (search) {
    query = query.or(
      `full_name.ilike.%${search}%,phone.ilike.%${search}%,question.ilike.%${search}%`
    )
  }

  const { data, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Status sayımları — manuel hesaplanır (RPC henüz yok)

  // Manuel sayım
  const statusList = ['pending', 'reviewing', 'suitable', 'not_suitable', 'needs_more_info', 'converted', 'archived']
  const statusCounts: Record<string, number> = {}
  await Promise.all(
    statusList.map(async (s) => {
      const { count: c } = await supabase
        .from('consultation_requests')
        .select('id', { count: 'exact', head: true })
        .eq('business_id', businessId)
        .eq('status', s)
      statusCounts[s] = c ?? 0
    })
  )

  return NextResponse.json({
    items: data ?? [],
    total: count ?? 0,
    counts: statusCounts,
  })
}
