import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { verifyCronAuth } from '@/lib/api/verify-cron'
import { getOpenAIClient, ASSISTANT_MODEL } from '@/lib/ai/openai-client'
import { handleDetectAnomalies, handleDetectRiskCustomers } from '@/lib/ai/assistant-tools'

export const runtime = 'nodejs'
export const maxDuration = 60

const MS_PER_DAY = 24 * 60 * 60 * 1000
const BRIEF_MAX_TOKENS = 400

export async function GET(request: NextRequest) {
  const authErr = verifyCronAuth(request)
  if (authErr) return authErr

  const admin = createAdminClient()
  const { data: businesses, error } = await admin
    .from('businesses')
    .select('id, name, sector, settings')
    .eq('is_active', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let briefs = 0
  let failures = 0

  for (const biz of businesses || []) {
    try {
      if ((biz as any).settings?.ai_preferences?.auto_brief_enabled === false) continue
      await generateAndStoreBrief(admin, biz.id, biz.name)
      briefs += 1
    } catch (err) {
      failures += 1
      console.error(`[ai-daily-brief] business ${biz.id} failed:`, err)
    }
  }

  return NextResponse.json({ ok: true, briefs, failures, total: businesses?.length || 0 })
}

async function generateAndStoreBrief(
  admin: ReturnType<typeof createAdminClient>,
  businessId: string,
  businessName: string,
) {
  const today = new Date()
  const todayIso = today.toISOString().split('T')[0]
  const tomorrow = new Date(today.getTime() + MS_PER_DAY)
  const tomorrowIso = tomorrow.toISOString().split('T')[0]

  const [todayAptsRes, tomorrowAptsRes, pendingMsgsRes, unpaidInvRes, anomaliesRes, riskRes] = await Promise.all([
    admin.from('appointments')
      .select('id, status, customers(name), services(name), start_time')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('appointment_date', todayIso),
    admin.from('appointments')
      .select('id')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('appointment_date', tomorrowIso),
    admin.from('messages')
      .select('id')
      .eq('business_id', businessId)
      .eq('direction', 'inbound')
      .eq('is_read', false)
      .limit(100),
    admin.from('invoices')
      .select('id, total, paid_amount')
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .in('status', ['pending', 'partial', 'overdue'])
      .limit(100),
    handleDetectAnomalies(admin, businessId),
    handleDetectRiskCustomers(admin, businessId, { limit: 5 }),
  ])

  const todayApts = todayAptsRes.data || []
  const tomorrowApts = tomorrowAptsRes.data || []
  const pendingMsgs = pendingMsgsRes.data || []
  const unpaidInv = unpaidInvRes.data || []
  const unpaidTotal = unpaidInv.reduce(
    (s: number, i: any) => s + Math.max(0, (i.total || 0) - (i.paid_amount || 0)),
    0,
  )

  const anomalies = anomaliesRes.success ? (anomaliesRes.data?.anomalies || []) : []
  const riskCustomers = riskRes.success ? (riskRes.data?.customers || []).slice(0, 5) : []

  const metrics = {
    today_appointments: todayApts.length,
    today_first: todayApts[0]
      ? { time: (todayApts[0] as any).start_time, customer: (todayApts[0] as any).customers?.name, service: (todayApts[0] as any).services?.name }
      : null,
    tomorrow_appointments: tomorrowApts.length,
    pending_messages: pendingMsgs.length,
    unpaid_invoices: unpaidInv.length,
    unpaid_total: Math.round(unpaidTotal * 100) / 100,
    anomalies,
    risk_customers_preview: riskCustomers.map((c: any) => ({ name: c.name, days: c.days_since_last_visit })),
  }

  const brief = await generateBriefText(businessName, metrics)
  if (!brief) return

  const todayLabel = today.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  await admin.from('notifications').insert({
    business_id: businessId,
    type: 'ai_brief',
    title: `Günün Özeti — ${todayLabel}`,
    body: brief,
    is_read: false,
  })
}

async function generateBriefText(
  businessName: string,
  metrics: Record<string, any>,
): Promise<string | null> {
  try {
    const openai = getOpenAIClient()
    const res = await openai.chat.completions.create({
      model: ASSISTANT_MODEL,
      max_tokens: BRIEF_MAX_TOKENS,
      messages: [
        {
          role: 'system',
          content: `Sen ${businessName} işletmesinin sabah brief asistanısın. Aldığın metrikleri okuyup 3-5 kısa madde halinde Türkçe sabah özeti yaz. Sade, pratik, eylem odaklı ol. Gereksiz selamlama yapma, doğrudan maddelere geç. Anomali yoksa pozitif not ver. Emoji kullanma.`,
        },
        {
          role: 'user',
          content: `Metrikler (JSON):\n${JSON.stringify(metrics, null, 2)}\n\nKısa özet hazırla.`,
        },
      ],
    })
    return res.choices[0]?.message?.content?.trim() || null
  } catch (err) {
    console.error('[ai-daily-brief] openai error:', err)
    return null
  }
}
