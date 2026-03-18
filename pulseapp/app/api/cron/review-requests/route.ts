import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = { sent: 0, errors: 0 }

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, updated_at,
      customers(id, name, phone),
      businesses(id, name, google_maps_url, settings)
    `)
    .eq('status', 'completed')
    .eq('review_requested', false)

  for (const apt of appointments || []) {
    const customer = apt.customers as any
    const business = apt.businesses as any

    if (!customer?.phone || !business?.id) continue
    if (!business.settings?.auto_review_request) continue

    const delayMinutes = business.settings.review_request_delay_minutes ?? 30
    const readyAt = new Date(new Date(apt.updated_at).getTime() + delayMinutes * 60 * 1000)
    if (readyAt > now) continue

    try {
      await supabase
        .from('appointments')
        .update({ review_requested: true })
        .eq('id', apt.id)
      results.sent++
    } catch {
      results.errors++
      console.error(`Yorum istek hatası (${apt.id})`)
    }
  }

  return NextResponse.json({
    ok: true,
    timestamp: now.toISOString(),
    ...results,
  })
}
