import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditServer } from '@/lib/utils/audit'
import type { LoyaltyTier } from '@/types'

// GET /api/loyalty?customerId=xxx — Müşterinin puan bakiyesi + son işlemler
export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const customerId = request.nextUrl.searchParams.get('customerId')
  if (!customerId) return NextResponse.json({ error: 'customerId gerekli' }, { status: 400 })

  const admin = createAdminClient()

  const [{ data: loyalty }, { data: transactions }] = await Promise.all([
    admin
      .from('loyalty_points')
      .select('*')
      .eq('business_id', staff.business_id)
      .eq('customer_id', customerId)
      .single(),
    admin
      .from('point_transactions')
      .select('*')
      .eq('business_id', staff.business_id)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  return NextResponse.json({ loyalty: loyalty || null, transactions: transactions || [] })
}

// POST /api/loyalty — Puan ekle (randevu tamamlandığında)
// Body: { customerId, appointmentId, revenueAmount? }
// Idempotent: aynı appointment_id için ikinci kez puan eklenmez
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await request.json()
  const { customerId, appointmentId, revenueAmount = 0 } = body
  if (!customerId || !appointmentId) {
    return NextResponse.json({ error: 'customerId ve appointmentId gerekli' }, { status: 400 })
  }

  const admin = createAdminClient()

  // İşletme ayarlarını al
  const { data: biz } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', staff.business_id)
    .single()

  const settings = biz?.settings as Record<string, any> | null
  if (!settings?.loyalty_enabled) {
    return NextResponse.json({ ok: false, reason: 'Sadakat sistemi kapalı' })
  }

  const pointsPerCurrency: number = settings.points_per_currency ?? 1
  const visitBonus: number = settings.visit_bonus_points ?? 50
  const silverThreshold: number = settings.tier_silver_threshold ?? 500
  const goldThreshold: number = settings.tier_gold_threshold ?? 2000
  const autoRewardThreshold: number = settings.auto_reward_threshold ?? 500

  // Idempotency: Bu randevu için daha önce puan eklendi mi?
  const { data: existing } = await admin
    .from('point_transactions')
    .select('id')
    .eq('business_id', staff.business_id)
    .eq('customer_id', customerId)
    .eq('reference_id', appointmentId)
    .eq('source', 'appointment')
    .limit(1)

  if (existing && existing.length > 0) {
    return NextResponse.json({ ok: false, reason: 'Bu randevu için zaten puan eklendi' })
  }

  const earnedFromRevenue = Math.floor(revenueAmount * pointsPerCurrency)
  const totalEarned = earnedFromRevenue + visitBonus

  // Mevcut bakiyeyi al veya oluştur
  const { data: currentLoyalty } = await admin
    .from('loyalty_points')
    .select('*')
    .eq('business_id', staff.business_id)
    .eq('customer_id', customerId)
    .single()

  const oldBalance = currentLoyalty?.points_balance ?? 0
  const oldTotalEarned = currentLoyalty?.total_earned ?? 0
  const newBalance = oldBalance + totalEarned
  const newTotalEarned = oldTotalEarned + totalEarned

  const newTier: LoyaltyTier =
    newTotalEarned >= goldThreshold ? 'gold' :
    newTotalEarned >= silverThreshold ? 'silver' : 'bronze'

  // Upsert loyalty_points
  await admin
    .from('loyalty_points')
    .upsert(
      {
        business_id: staff.business_id,
        customer_id: customerId,
        points_balance: newBalance,
        tier: newTier,
        total_earned: newTotalEarned,
        total_spent: currentLoyalty?.total_spent ?? 0,
      },
      { onConflict: 'business_id,customer_id' }
    )

  // İşlem kayıtları: hizmet puanı + ziyaret bonusu ayrı ayrı
  const txRows = []
  if (earnedFromRevenue > 0) {
    txRows.push({
      business_id: staff.business_id,
      customer_id: customerId,
      type: 'earn',
      points: earnedFromRevenue,
      source: 'appointment',
      reference_id: appointmentId,
      description: `Randevu hizmet puanı (${revenueAmount}₺ × ${pointsPerCurrency})`,
    })
  }
  txRows.push({
    business_id: staff.business_id,
    customer_id: customerId,
    type: 'earn',
    points: visitBonus,
    source: 'visit_bonus',
    reference_id: appointmentId,
    description: 'Ziyaret bonusu',
  })

  await admin.from('point_transactions').insert(txRows)

  // Eşik aşıldı mı? (ödül SMS'i yalnızca Supabase'de log olarak bırakılıyor, gerçek SMS ayrıca gönderilebilir)
  const thresholdCrossed = oldBalance < autoRewardThreshold && newBalance >= autoRewardThreshold

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'create',
    resource: 'customer',
    resourceId: customerId,
    details: {
      type: 'loyalty_earn',
      appointmentId,
      pointsAdded: totalEarned,
      newBalance,
      newTier,
      thresholdCrossed,
    },
  })

  return NextResponse.json({
    ok: true,
    pointsAdded: totalEarned,
    newBalance,
    newTier,
    thresholdCrossed,
    tierChanged: newTier !== (currentLoyalty?.tier ?? 'bronze'),
  })
}
