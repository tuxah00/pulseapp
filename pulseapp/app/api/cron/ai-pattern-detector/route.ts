import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { createLogger } from '@/lib/utils/logger'
import { createInsightIfNotDuplicate } from '@/lib/ai/watcher/event-handlers'

const log = createLogger({ route: 'api/cron/ai-pattern-detector' })

export const runtime = 'nodejs'
export const maxDuration = 60

// Minimum tekrar sayısı
const REPEAT_THRESHOLD = 3
// Kaç günlük geçmişe bakılacak
const LOOKBACK_DAYS = 7

// Otomasyon önerilebilecek aksiyonlar
const AUTOMATABLE_ACTIONS: Record<string, string> = {
  'send': 'mesaj gönderme',
  'create_appointment': 'randevu oluşturma',
  'record_invoice_payment': 'ödeme kaydetme',
}

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()

  // Son LOOKBACK_DAYS günlük audit log'u çek
  const { data: logs, error } = await admin
    .from('audit_logs')
    .select('business_id, staff_id, staff_name, action, resource, created_at')
    .gte('created_at', since)
    .in('action', Object.keys(AUTOMATABLE_ACTIONS))
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // İşletme + aksiyon + kaynak bazında grupla
  const groups: Record<string, { business_id: string; action: string; resource: string; count: number; staff_name: string }> = {}
  for (const entry of logs ?? []) {
    const key = `${entry.business_id}::${entry.action}::${entry.resource}`
    if (!groups[key]) {
      groups[key] = { business_id: entry.business_id, action: entry.action, resource: entry.resource, count: 0, staff_name: entry.staff_name }
    }
    groups[key].count++
  }

  let proposals = 0
  for (const grp of Object.values(groups)) {
    if (grp.count < REPEAT_THRESHOLD) continue
    const actionLabel = AUTOMATABLE_ACTIONS[grp.action]
    if (!actionLabel) continue

    const ok = await createInsightIfNotDuplicate(admin, {
      business_id: grp.business_id,
      type: 'automation_proposal',
      severity: 'info',
      source_event_type: 'manual_work_detected',
      title: `Son ${LOOKBACK_DAYS} günde ${grp.count}× ${actionLabel} yapıldı`,
      body: `"${grp.resource}" için tekrarlayan ${actionLabel} işlemi tespit edildi. Bu akışı otomatik mesaj (workflow) olarak kurarak zaman kazanabilirsiniz.`,
      suggested_action: {
        tool_name: 'create_workflow',
        args: { trigger: grp.action, resource: grp.resource },
        label: 'Workflow Kur',
        href: `/dashboard/workflows`,
      },
    })
    if (ok) proposals++
  }

  log.info({ proposals, groups_checked: Object.keys(groups).length }, '[ai-pattern-detector] tamamlandı')

  return NextResponse.json({ ok: true, proposals, groups_checked: Object.keys(groups).length })
}
