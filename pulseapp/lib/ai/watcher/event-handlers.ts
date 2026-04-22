import type { SupabaseClient } from '@supabase/supabase-js'

export type InsightType = 'opportunity' | 'risk' | 'suggestion' | 'automation_proposal'
export type InsightSeverity = 'info' | 'normal' | 'high' | 'critical'

export interface InsightToCreate {
  business_id: string
  type: InsightType
  title: string
  body: string
  severity: InsightSeverity
  source_event_type: string
  related_entity_id?: string
  suggested_action?: {
    tool_name: string
    args: Record<string, unknown>
    label: string
    href?: string  // alternatif: sayfaya yönlendir
  }
  expires_at?: string
}

/**
 * Insight'ı deduplication ile oluşturur.
 * Aynı business + source_event_type + related_entity_id kombinasyonu
 * son 24 saatte varsa skip eder.
 */
export async function createInsightIfNotDuplicate(
  admin: SupabaseClient,
  insight: InsightToCreate,
): Promise<boolean> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const query = admin
    .from('ai_insights')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', insight.business_id)
    .eq('source_event_type', insight.source_event_type)
    .gte('created_at', since)
    .in('status', ['new', 'viewed'])

  if (insight.related_entity_id) {
    query.eq('related_entity_id', insight.related_entity_id)
  }

  const { count } = await query
  if ((count ?? 0) > 0) return false  // zaten var

  const { error } = await admin.from('ai_insights').insert({
    business_id: insight.business_id,
    type: insight.type,
    title: insight.title,
    body: insight.body,
    severity: insight.severity,
    source_event_type: insight.source_event_type,
    related_entity_id: insight.related_entity_id ?? null,
    suggested_action: insight.suggested_action ?? null,
    expires_at: insight.expires_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  })

  return !error
}

/** No-show randevular için insight oluştur */
export async function handleNoShowEvents(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: noShows } = await admin
    .from('appointments')
    .select('id, customer_id, customers(name), services(name)')
    .eq('business_id', businessId)
    .eq('status', 'no_show')
    .gte('updated_at', since)
    .is('deleted_at', null)
    .limit(5)

  let created = 0
  for (const apt of noShows ?? []) {
    const customerName = (apt.customers as any)?.name ?? 'Müşteri'
    const serviceName = (apt.services as any)?.name ?? 'hizmet'
    const ok = await createInsightIfNotDuplicate(admin, {
      business_id: businessId,
      type: 'risk',
      severity: 'normal',
      source_event_type: 'no_show',
      related_entity_id: apt.id,
      title: `${customerName} randevuya gelmedi`,
      body: `${customerName} bugün ${serviceName} randevusuna gelmedi. Kısa bir mesaj göndermek müşteriyi geri kazandırabilir.`,
      suggested_action: {
        tool_name: 'send_message',
        args: { customer_id: apt.customer_id, channel: 'auto' },
        label: 'Mesaj Gönder',
        href: `/dashboard/messages`,
      },
      expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    })
    if (ok) created++
  }
  return created
}

/** Gecikmiş faturalar için insight oluştur */
export async function handleOverdueInvoices(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: invoices } = await admin
    .from('invoices')
    .select('id, customer_id, customers(name), total, created_at')
    .eq('business_id', businessId)
    .eq('status', 'pending')
    .is('deleted_at', null)
    .lt('created_at', sevenDaysAgo)
    .limit(5)

  let created = 0
  for (const inv of invoices ?? []) {
    const customerName = (inv.customers as any)?.name ?? 'Müşteri'
    const daysPassed = Math.floor((Date.now() - new Date(inv.created_at).getTime()) / (24 * 60 * 60 * 1000))
    const ok = await createInsightIfNotDuplicate(admin, {
      business_id: businessId,
      type: 'risk',
      severity: daysPassed > 14 ? 'high' : 'normal',
      source_event_type: 'invoice_overdue',
      related_entity_id: inv.id,
      title: `${customerName} faturası ${daysPassed} gündür ödenmedi`,
      body: `${customerName} için ₺${Number(inv.total).toLocaleString('tr-TR')} tutarında fatura ${daysPassed} gündür bekliyor. Hatırlatma mesajı göndermek ister misiniz?`,
      suggested_action: {
        tool_name: 'send_message',
        args: { customer_id: inv.customer_id, channel: 'auto' },
        label: 'Hatırlatma Gönder',
        href: `/dashboard/invoices`,
      },
    })
    if (ok) created++
  }
  return created
}

/** VIP/regular müşteri kaybı için insight oluştur */
export async function handleChurnedCustomers(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  // Son randevusu 90 günden eski VIP/regular müşteriler
  const { data: customers } = await admin
    .from('customers')
    .select('id, name, segment, last_visit')
    .eq('business_id', businessId)
    .in('segment', ['vip', 'regular'])
    .not('last_visit', 'is', null)
    .lt('last_visit', ninetyDaysAgo)
    .order('last_visit', { ascending: true })
    .limit(3)

  let created = 0
  for (const customer of customers ?? []) {
    const daysPassed = Math.floor((Date.now() - new Date(customer.last_visit).getTime()) / (24 * 60 * 60 * 1000))
    const ok = await createInsightIfNotDuplicate(admin, {
      business_id: businessId,
      type: 'risk',
      severity: customer.segment === 'vip' ? 'high' : 'normal',
      source_event_type: 'customer_churned',
      related_entity_id: customer.id,
      title: `${customer.segment === 'vip' ? 'VIP müşteri' : 'Müşteri'} ${customer.name} ${daysPassed} gündür gelmiyor`,
      body: `${customer.name} son ${daysPassed} gündür işletmenizi ziyaret etmedi. Geri kazanım mesajı göndermek ister misiniz?`,
      suggested_action: {
        tool_name: 'send_message',
        args: { customer_id: customer.id, channel: 'auto' },
        label: 'Geri Kazan',
        href: `/dashboard/messages`,
      },
    })
    if (ok) created++
  }
  return created
}

/** Gelir anomalisi için insight oluştur */
export async function handleRevenueAnomaly(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const now = new Date()
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const twoWeeksStart = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [thisWeekRes, lastWeekRes] = await Promise.all([
    admin
      .from('appointments')
      .select('price')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .gte('appointment_date', weekStart.toISOString().split('T')[0])
      .lt('appointment_date', now.toISOString().split('T')[0]),
    admin
      .from('appointments')
      .select('price')
      .eq('business_id', businessId)
      .eq('status', 'completed')
      .is('deleted_at', null)
      .gte('appointment_date', twoWeeksStart.toISOString().split('T')[0])
      .lt('appointment_date', weekStart.toISOString().split('T')[0]),
  ])

  const thisWeek = (thisWeekRes.data ?? []).reduce((s, r) => s + (Number(r.price) || 0), 0)
  const lastWeek = (lastWeekRes.data ?? []).reduce((s, r) => s + (Number(r.price) || 0), 0)

  if (lastWeek === 0 || thisWeek === 0) return 0
  const dropPct = ((lastWeek - thisWeek) / lastWeek) * 100

  if (dropPct < 20) return 0  // eşik altı, insight üretme

  const ok = await createInsightIfNotDuplicate(admin, {
    business_id: businessId,
    type: 'risk',
    severity: dropPct > 40 ? 'high' : 'normal',
    source_event_type: 'revenue_anomaly',
    title: `Bu hafta gelir %${Math.round(dropPct)} düştü`,
    body: `Geçen hafta ₺${lastWeek.toLocaleString('tr-TR')} olan geliriniz bu hafta ₺${thisWeek.toLocaleString('tr-TR')}'ye geriledi. Detaylı analiz için asistana sorun.`,
    suggested_action: {
      tool_name: 'get_revenue_breakdown',
      args: {},
      label: 'Analiz Et',
      href: `/dashboard/analytics`,
    },
  })
  return ok ? 1 : 0
}

/** Slot boşluğu (3 günlük takvimde randevu yoksa) için insight oluştur */
export async function handleSlotGaps(
  admin: SupabaseClient,
  businessId: string,
): Promise<number> {
  const today = new Date()
  const threeDaysLater = new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000)
  const todayStr = today.toISOString().split('T')[0]
  const laterStr = threeDaysLater.toISOString().split('T')[0]

  const { count } = await admin
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .gte('appointment_date', todayStr)
    .lt('appointment_date', laterStr)
    .is('deleted_at', null)
    .not('status', 'in', '(cancelled)')

  if ((count ?? 0) > 3) return 0  // yeterli randevu var

  // Bekleme listesinde biri var mı?
  const { count: waitlistCount } = await admin
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('status', 'waiting')

  const ok = await createInsightIfNotDuplicate(admin, {
    business_id: businessId,
    type: 'opportunity',
    severity: (waitlistCount ?? 0) > 0 ? 'high' : 'normal',
    source_event_type: 'slot_gap',
    title: `Önümüzdeki 3 günde ${count ?? 0} randevu var`,
    body: (waitlistCount ?? 0) > 0
      ? `Takviminizde boşluk var. Bekleme listesinde ${waitlistCount} kişi bulunuyor — onlara teklif göndermek ister misiniz?`
      : `Önümüzdeki 3 günlük takviminiz oldukça seyrek. Mevcut müşterilere kampanya açmak ister misiniz?`,
    suggested_action: {
      tool_name: 'list_campaigns',
      args: {},
      label: (waitlistCount ?? 0) > 0 ? 'Bekleme Listesi' : 'Kampanya Oluştur',
      href: (waitlistCount ?? 0) > 0 ? `/dashboard/waitlist` : `/dashboard/campaigns`,
    },
    expires_at: new Date(today.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  })
  return ok ? 1 : 0
}
