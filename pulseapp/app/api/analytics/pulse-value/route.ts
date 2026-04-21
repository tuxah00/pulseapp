import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { toInclusiveEnd } from '@/lib/utils/date-range'
import { PULSE_VALUE_ASSUMPTIONS as ASSUMPTIONS } from '@/lib/analytics/pulse-value-methods'

// GET — PulseApp'in işletmeye kazandırdıklarını ölçer
// Params: ?from=YYYY-MM-DD&to=YYYY-MM-DD (opsiyonel; yoksa son 30 gün)
export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, 'analytics')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const { searchParams } = new URL(request.url)
  const toParam = searchParams.get('to')
  const fromParam = searchParams.get('from')

  const now = new Date()
  const to = toParam || now.toISOString().split('T')[0]
  const fromDefault = new Date(now); fromDefault.setDate(now.getDate() - 30)
  const from = fromParam || fromDefault.toISOString().split('T')[0]

  const fromIso = `${from}T00:00:00.000Z`
  const toIso = toInclusiveEnd(to) ?? `${to}T23:59:59.999Z`

  const admin = createAdminClient()

  const [
    reminders24Res,
    reminders2Res,
    confirmationsRes,
    aiActionsRes,
    systemMessagesRes,
    followUpsRes,
    webAptsRes,
    aiAptsRes,
    gapFillRes,
    campaignAptsRes,
    referralsRes,
    winbackRes,
    rewardsUsedRes,
    birthdayMsgsRes,
    reviewReqRes,
    reviewsRes,
    posRes,
    periodicRes,
    workflowRes,
  ] = await Promise.all([
    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('reminder_24h_sent', true)
      .gte('appointment_date', from)
      .lte('appointment_date', to),

    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('reminder_2h_sent', true)
      .gte('appointment_date', from)
      .lte('appointment_date', to),

    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('confirmation_status', 'confirmed_by_customer')
      .gte('appointment_date', from)
      .lte('appointment_date', to),

    admin.from('ai_pending_actions')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'executed')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('message_type', 'system')
      .eq('direction', 'outbound')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('follow_up_queue')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'sent')
      .gte('scheduled_for', fromIso)
      .lte('scheduled_for', toIso),

    admin.from('appointments')
      .select('services(price)')
      .eq('business_id', businessId)
      .eq('source', 'web')
      .is('deleted_at', null)
      .gte('appointment_date', from)
      .lte('appointment_date', to),

    admin.from('appointments')
      .select('services(price)')
      .eq('business_id', businessId)
      .eq('source', 'ai_assistant')
      .is('deleted_at', null)
      .gte('appointment_date', from)
      .lte('appointment_date', to),

    admin.from('gap_fill_notifications')
      .select('appointments(services(price))')
      .eq('business_id', businessId)
      .not('appointment_id', 'is', null)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    // Kampanya alıcıları — tenancy inner join ile güvenceye alınır (tablo business_id taşımıyor)
    admin.from('campaign_recipients')
      .select('customer_id, sent_at, campaigns!inner(business_id)')
      .eq('campaigns.business_id', businessId)
      .eq('status', 'sent')
      .gte('sent_at', fromIso)
      .lte('sent_at', toIso),

    admin.from('referrals')
      .select('reward_value')
      .eq('business_id', businessId)
      .in('status', ['converted', 'rewarded'])
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('campaigns')
      .select('sent_count')
      .eq('business_id', businessId)
      .eq('type', 'winback')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('customer_rewards')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'used')
      .gte('used_at', fromIso)
      .lte('used_at', toIso),

    admin.from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('message_type', 'birthday')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .eq('review_requested', true)
      .gte('appointment_date', from)
      .lte('appointment_date', to),

    admin.from('reviews')
      .select('rating')
      .eq('business_id', businessId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('pos_transactions')
      .select('total')
      .eq('business_id', businessId)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),

    admin.from('periodic_reminders_sent')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .gte('sent_at', fromIso)
      .lte('sent_at', toIso),

    admin.from('workflow_runs')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
  ])

  // ═══ Otomasyon Kazanımları ═══
  const reminders24 = reminders24Res.count || 0
  const reminders2 = reminders2Res.count || 0
  const reminderMinutes = (reminders24 + reminders2) * ASSUMPTIONS.minutes_per_reminder

  const selfConfirmations = confirmationsRes.count || 0
  const confirmationMinutes = selfConfirmations * ASSUMPTIONS.minutes_per_confirmation

  const aiActions = aiActionsRes.count || 0
  const aiActionMinutes = aiActions * ASSUMPTIONS.minutes_per_ai_action

  const systemMessages = systemMessagesRes.count || 0
  const systemMessageMinutes = systemMessages * ASSUMPTIONS.minutes_per_message

  const followUps = followUpsRes.count || 0
  const followUpMinutes = followUps * ASSUMPTIONS.minutes_per_followup

  const totalSavedMinutes = reminderMinutes + confirmationMinutes + aiActionMinutes + systemMessageMinutes + followUpMinutes
  const savedMoneyEstimate = Math.round((totalSavedMinutes / 60) * ASSUMPTIONS.hourly_rate_try)

  // ═══ Dijital Kanal Geliri ═══
  // Supabase join tek obje veya dizi dönebilir (types'da dizi olarak infer edilir)
  type SvcRef = { price?: number | null } | Array<{ price?: number | null }> | null | undefined
  const extractPrice = (svc: SvcRef): number => {
    if (!svc) return 0
    const single = Array.isArray(svc) ? svc[0] : svc
    return Number(single?.price) || 0
  }
  const sumAptPrices = (list: Array<{ services?: SvcRef }>): number =>
    list.reduce((sum, a) => sum + extractPrice(a.services), 0)

  const webApts = webAptsRes.data || []
  const aiApts = aiAptsRes.data || []
  const gapFillList = gapFillRes.data || []

  const webRevenue = sumAptPrices(webApts)
  const aiRevenue = sumAptPrices(aiApts)
  const gapFillRevenue = gapFillList.reduce((sum, g) => {
    const nestedApt = (g as { appointments?: { services?: SvcRef } | Array<{ services?: SvcRef }> | null }).appointments
    const apt = Array.isArray(nestedApt) ? nestedApt[0] : nestedApt
    return sum + extractPrice(apt?.services)
  }, 0)

  // Kampanya attribution: sent_at'ten sonraki X gün içinde alınan randevu (indirect)
  const campaignSent = campaignAptsRes.data || []
  let campaignRevenue = 0
  let campaignSourcedCount = 0
  if (campaignSent.length > 0) {
    const customerIds = Array.from(new Set(campaignSent.map(r => r.customer_id).filter(Boolean)))
    if (customerIds.length > 0) {
      const sentTimes = campaignSent
        .map(r => new Date(r.sent_at).getTime())
        .filter(t => !isNaN(t))
      const earliestSent = sentTimes.length > 0 ? Math.min(...sentTimes) : Date.now()
      const earliestSentDate = new Date(earliestSent).toISOString().split('T')[0]

      const { data: sourcedApts } = await admin
        .from('appointments')
        .select('customer_id, appointment_date, services(price)')
        .eq('business_id', businessId)
        .is('deleted_at', null)
        .in('customer_id', customerIds)
        .gte('appointment_date', earliestSentDate)
        .lte('appointment_date', to)

      const sourced = sourcedApts || []
      const sentMap = new Map<string, number>()
      for (const r of campaignSent) {
        if (!r.customer_id || !r.sent_at) continue
        const t = new Date(r.sent_at).getTime()
        const prev = sentMap.get(r.customer_id as string)
        if (prev === undefined || t < prev) sentMap.set(r.customer_id as string, t)
      }

      const windowMs = ASSUMPTIONS.attribution_window_days * 24 * 60 * 60 * 1000
      for (const apt of sourced) {
        const sentTime = sentMap.get(apt.customer_id as string)
        if (sentTime === undefined) continue
        // UTC parse — sent_at UTC olduğu için tutarlı karşılaştırma
        const aptTime = new Date(apt.appointment_date + 'T00:00:00Z').getTime()
        const diff = aptTime - sentTime
        if (diff >= 0 && diff <= windowMs) {
          campaignSourcedCount += 1
          campaignRevenue += extractPrice(apt.services as SvcRef)
        }
      }
    }
  }

  const totalDigitalRevenue = webRevenue + aiRevenue + gapFillRevenue + campaignRevenue

  // ═══ Müşteri Büyüme & Geri Dönüş ═══
  const referralList = referralsRes.data || []
  const referralCount = referralList.length
  const referralRevenue = referralList.reduce((sum, r) => sum + (Number(r.reward_value) || 0), 0)

  const winbackCampaigns = winbackRes.data || []
  const winbackSentCount = winbackCampaigns.reduce((sum, c) => sum + (c.sent_count || 0), 0)

  const rewardsUsed = rewardsUsedRes.count || 0
  const birthdayDriven = birthdayMsgsRes.count || 0

  const newReturningCustomers = referralCount + winbackSentCount

  // ═══ Müşteri Deneyimi & Dijitalleşme ═══
  const reviewRequests = reviewReqRes.count || 0
  const reviewsReceived = reviewsRes.data || []
  const avgRating = reviewsReceived.length > 0
    ? reviewsReceived.reduce((sum, r) => sum + (r.rating || 0), 0) / reviewsReceived.length
    : 0

  const posTransactions = posRes.data || []
  const posTotal = posTransactions.reduce((sum, t) => sum + (Number(t.total) || 0), 0)

  const periodicReminders = periodicRes.count || 0
  const workflowRuns = workflowRes.count || 0

  return NextResponse.json({
    period: { from, to },
    assumptions: ASSUMPTIONS,
    summary: {
      saved_minutes: totalSavedMinutes,
      saved_money_estimate: savedMoneyEstimate,
      digital_revenue: totalDigitalRevenue,
      new_returning_customers: newReturningCustomers,
    },
    automation: {
      reminders_24h: { count: reminders24, est_minutes: reminders24 * ASSUMPTIONS.minutes_per_reminder },
      reminders_2h: { count: reminders2, est_minutes: reminders2 * ASSUMPTIONS.minutes_per_reminder },
      self_confirmations: { count: selfConfirmations, est_minutes: confirmationMinutes },
      ai_actions: { count: aiActions, est_minutes: aiActionMinutes },
      system_messages: { count: systemMessages, est_minutes: systemMessageMinutes },
      follow_ups: { count: followUps, est_minutes: followUpMinutes },
    },
    digital_revenue: {
      web_appointments: { count: webApts.length, revenue: webRevenue },
      ai_appointments: { count: aiApts.length, revenue: aiRevenue },
      gap_fill: { count: gapFillList.length, revenue: gapFillRevenue },
      campaign_sourced: { count: campaignSourcedCount, revenue: campaignRevenue },
    },
    growth: {
      referrals_converted: { count: referralCount, revenue: referralRevenue },
      winback_recovered: { count: winbackSentCount },
      rewards_used: { count: rewardsUsed },
      birthday_driven: { count: birthdayDriven },
    },
    experience: {
      review_requests: { count: reviewRequests },
      reviews_received: { count: reviewsReceived.length, avg_rating: Math.round(avgRating * 10) / 10 },
      pos_transactions: { count: posTransactions.length, total: posTotal },
      periodic_reminders: { count: periodicReminders },
      workflow_runs: { count: workflowRuns },
    },
  })
}
