import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/cron/ai-insights-cleanup' })

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * T2.5 — AI insights cleanup (günlük)
 *
 * `ai_insights` tablosu zamanla şişer çünkü insight'lar sadece status değiştikçe
 * işaretlenir, fiziksel silinmez. Bu cron:
 *  - expires_at < now() olanları siler
 *  - dismissed/acted olup 30+ gün eski olanları siler
 *
 * vercel.json cron taslağı (Vercel Pro subscription açıldığında):
 *   { "path": "/api/cron/ai-insights-cleanup", "schedule": "0 3 * * *" }
 */
export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60_000).toISOString()

  // Expired
  const { count: expiredCount, error: expiredErr } = await admin
    .from('ai_insights')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())

  // Dismissed / acted eskiler
  const { count: oldCount, error: oldErr } = await admin
    .from('ai_insights')
    .delete({ count: 'exact' })
    .in('status', ['dismissed', 'acted'])
    .lt('created_at', cutoff)

  if (expiredErr || oldErr) {
    log.error({ expiredErr, oldErr }, 'AI insights cleanup hata')
    return NextResponse.json({ error: 'cleanup_failed' }, { status: 500 })
  }

  log.info({ expired: expiredCount ?? 0, old: oldCount ?? 0 }, 'AI insights cleanup tamamlandı')
  return NextResponse.json({
    ok: true,
    deleted: { expired: expiredCount ?? 0, old_processed: oldCount ?? 0 },
  })
}
