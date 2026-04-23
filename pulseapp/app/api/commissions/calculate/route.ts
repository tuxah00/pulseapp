import { NextRequest, NextResponse } from 'next/server'
import { requirePermission } from '@/lib/api/with-permission'
import { createAdminClient } from '@/lib/supabase/admin'
import { addMonthsSafe } from '@/lib/utils/date-range'

interface CommissionRule {
  id: string
  staff_id: string | null
  service_id: string | null
  rate_percent: number | null
  rate_fixed: number | null
}

interface Appointment {
  id: string
  staff_id: string | null
  service_id: string | null
  services?: { price: number | null } | null
}

// POST — Belirli dönem için prim hesapla ve kaydet
export async function POST(request: NextRequest) {
  const auth = await requirePermission(request, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await request.json()
  const { period } = body  // 'YYYY-MM' format

  if (!period || !/^\d{4}-\d{2}$/.test(period)) {
    return NextResponse.json({ error: 'Geçerli bir dönem giriniz (YYYY-MM formatında)' }, { status: 400 })
  }

  const admin = createAdminClient()

  // 1. Tüm aktif personeli çek
  const { data: staffList, error: staffError } = await admin
    .from('staff_members')
    .select('id, name')
    .eq('business_id', businessId)
    .eq('is_active', true)

  if (staffError) return NextResponse.json({ error: staffError.message }, { status: 500 })
  if (!staffList || staffList.length === 0) {
    return NextResponse.json({ earnings: [] })
  }

  // 2. Dönem için tamamlanmış randevuları çek (YYYY-MM → ay aralığı)
  const [yearStr, monthStr] = period.split('-')
  const periodStart = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1)
  const periodEnd = addMonthsSafe(periodStart, 1)
  const periodStartStr = `${yearStr}-${monthStr}-01`
  const periodEndStr = periodEnd.toISOString().slice(0, 10)

  const { data: appointments, error: aptError } = await admin
    .from('appointments')
    .select('id, staff_id, service_id, services(price)')
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .is('deleted_at', null)
    .gte('appointment_date', periodStartStr)
    .lt('appointment_date', periodEndStr)

  if (aptError) return NextResponse.json({ error: aptError.message }, { status: 500 })

  // 3. Komisyon kurallarını çek
  const { data: rules, error: rulesError } = await admin
    .from('commission_rules')
    .select('id, staff_id, service_id, rate_percent, rate_fixed')
    .eq('business_id', businessId)

  if (rulesError) return NextResponse.json({ error: rulesError.message }, { status: 500 })

  const commissionRules: CommissionRule[] = rules || []

  // Kural eşleme fonksiyonu (öncelik: staff+service > staff-only > service-only > global)
  function findMatchingRule(staffId: string | null, serviceId: string | null): CommissionRule | null {
    // 1. staff + service exact match
    if (staffId && serviceId) {
      const r = commissionRules.find(r => r.staff_id === staffId && r.service_id === serviceId)
      if (r) return r
    }
    // 2. staff only (no service filter)
    if (staffId) {
      const r = commissionRules.find(r => r.staff_id === staffId && r.service_id === null)
      if (r) return r
    }
    // 3. service only (no staff filter)
    if (serviceId) {
      const r = commissionRules.find(r => r.staff_id === null && r.service_id === serviceId)
      if (r) return r
    }
    // 4. global rule (no staff, no service)
    const r = commissionRules.find(r => r.staff_id === null && r.service_id === null)
    return r || null
  }

  // 4. Her personel için prim hesapla
  const staffMap = new Map<string, { appointmentCount: number; totalRevenue: number; commissionTotal: number }>()

  for (const apt of (appointments as unknown as Appointment[]) || []) {
    if (!apt.staff_id) continue

    const price = apt.services?.price ?? 0
    const rule = findMatchingRule(apt.staff_id, apt.service_id)

    let commission = 0
    if (rule) {
      // rate_percent null değilse (0 dahil) yüzde uygula; aksi halde fixed kullan
      if (rule.rate_percent !== null && rule.rate_percent !== undefined) {
        commission = Math.max(0, (price * rule.rate_percent) / 100)
      } else if (rule.rate_fixed !== null && rule.rate_fixed !== undefined) {
        commission = Math.max(0, rule.rate_fixed)
      }
    }

    const existing = staffMap.get(apt.staff_id) || { appointmentCount: 0, totalRevenue: 0, commissionTotal: 0 }
    staffMap.set(apt.staff_id, {
      appointmentCount: existing.appointmentCount + 1,
      totalRevenue: existing.totalRevenue + price,
      commissionTotal: existing.commissionTotal + commission,
    })
  }

  // 5. Tüm aktif personel için sonuçları upsert et (zaten 'paid' ise atla)
  const earningsToUpsert = []

  // Önce mevcut kayıtları çek
  const { data: existingEarnings } = await admin
    .from('commission_earnings')
    .select('staff_id, status')
    .eq('business_id', businessId)
    .eq('period', period)

  const paidStaffIds = new Set(
    (existingEarnings || []).filter(e => e.status === 'paid').map(e => e.staff_id)
  )

  for (const member of staffList) {
    if (paidStaffIds.has(member.id)) continue  // Ödenmiş dönem güncellenmez

    const stats = staffMap.get(member.id) || { appointmentCount: 0, totalRevenue: 0, commissionTotal: 0 }
    earningsToUpsert.push({
      business_id: businessId,
      staff_id: member.id,
      period,
      appointment_count: stats.appointmentCount,
      total_revenue: Math.round(stats.totalRevenue * 100) / 100,
      commission_total: Math.round(stats.commissionTotal * 100) / 100,
      status: 'pending',
    })
  }

  if (earningsToUpsert.length > 0) {
    const { error: upsertError } = await admin
      .from('commission_earnings')
      .upsert(earningsToUpsert, { onConflict: 'business_id,staff_id,period' })

    if (upsertError) return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  // 6. Güncel kayıtları döndür
  const { data: finalEarnings, error: fetchError } = await admin
    .from('commission_earnings')
    .select('*, staff_members(id, name)')
    .eq('business_id', businessId)
    .eq('period', period)
    .order('commission_total', { ascending: false })

  if (fetchError) return NextResponse.json({ error: fetchError.message }, { status: 500 })

  return NextResponse.json({ earnings: finalEarnings || [], period })
}
