import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditServer } from '@/lib/utils/audit'

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

  const [{ data: loyalty }, { data: transactions }, { data: biz }] = await Promise.all([
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
    admin
      .from('businesses')
      .select('settings')
      .eq('id', staff.business_id)
      .single(),
  ])

  const settings = biz?.settings as Record<string, any> | null
  const redemptionRate: number = settings?.redemption_rate ?? 10

  return NextResponse.json({ loyalty: loyalty || null, transactions: transactions || [], redemptionRate })
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
  const newBalance = oldBalance + totalEarned
  const newTotalEarned = (currentLoyalty?.total_earned ?? 0) + totalEarned

  // Upsert loyalty_points
  await admin
    .from('loyalty_points')
    .upsert(
      {
        business_id: staff.business_id,
        customer_id: customerId,
        points_balance: newBalance,
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
    details: { type: 'loyalty_earn', appointmentId, pointsAdded: totalEarned, newBalance, thresholdCrossed },
  })

  return NextResponse.json({ ok: true, pointsAdded: totalEarned, newBalance, thresholdCrossed })
}

// DELETE /api/loyalty?customerId=X&appointmentId=Y
// Tamamlandı geri alındığında çağrılır — randevu için verilen puanları geri al.
// Idempotent: ilgili randevu için earn transaction yoksa sessizce { ok: true, pointsReverted: 0 } döner.
export async function DELETE(request: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data: staff } = await supabase
    .from('staff_members')
    .select('id, name, business_id')
    .eq('user_id', user.id)
    .single()
  if (!staff) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const customerId = request.nextUrl.searchParams.get('customerId')
  const appointmentId = request.nextUrl.searchParams.get('appointmentId')
  if (!customerId || !appointmentId) {
    return NextResponse.json({ error: 'customerId ve appointmentId gerekli' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Randevuya ait earn transaction'ları (hizmet puanı + ziyaret bonusu)
  const { data: txs } = await admin
    .from('point_transactions')
    .select('id, points')
    .eq('business_id', staff.business_id)
    .eq('customer_id', customerId)
    .eq('reference_id', appointmentId)
    .eq('type', 'earn')
    .in('source', ['appointment', 'visit_bonus'])

  if (!txs || txs.length === 0) {
    return NextResponse.json({ ok: true, pointsReverted: 0 })
  }

  const totalPoints = txs.reduce((sum, t) => sum + (t.points || 0), 0)

  // Mevcut bakiyeden düş — total_earned'dan da düş (sanki hiç verilmemiş gibi)
  const { data: loy } = await admin
    .from('loyalty_points')
    .select('id, points_balance, total_earned')
    .eq('business_id', staff.business_id)
    .eq('customer_id', customerId)
    .single()

  if (loy) {
    await admin
      .from('loyalty_points')
      .update({
        points_balance: Math.max(0, (loy.points_balance ?? 0) - totalPoints),
        total_earned: Math.max(0, (loy.total_earned ?? 0) - totalPoints),
      })
      .eq('id', loy.id)
  }

  // Transaction'ları kaldır — yeni earn yapılırsa idempotent kontrol tekrar geçerli olur
  await admin
    .from('point_transactions')
    .delete()
    .in('id', txs.map(t => t.id))

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'update',
    resource: 'customer',
    resourceId: customerId,
    details: { type: 'loyalty_revert', appointmentId, pointsReverted: totalPoints },
  })

  return NextResponse.json({ ok: true, pointsReverted: totalPoints })
}

// PATCH /api/loyalty — Manuel puan harcama (indirim uygulama)
// Body: { customerId, points, description? }
export async function PATCH(request: NextRequest) {
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
  const { customerId, points, description = 'Manuel indirim' } = body
  if (!customerId || !points || points <= 0) {
    return NextResponse.json({ error: 'customerId ve geçerli bir puan miktarı gerekli' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: currentLoyalty } = await admin
    .from('loyalty_points')
    .select('*')
    .eq('business_id', staff.business_id)
    .eq('customer_id', customerId)
    .single()

  if (!currentLoyalty) {
    return NextResponse.json({ error: 'Müşterinin puan kaydı bulunamadı' }, { status: 404 })
  }

  if (currentLoyalty.points_balance < points) {
    return NextResponse.json({ error: `Yetersiz puan. Mevcut bakiye: ${currentLoyalty.points_balance}` }, { status: 400 })
  }

  const newBalance = currentLoyalty.points_balance - points
  const newTotalSpent = currentLoyalty.total_spent + points

  await Promise.all([
    admin
      .from('loyalty_points')
      .update({ points_balance: newBalance, total_spent: newTotalSpent })
      .eq('id', currentLoyalty.id),
    admin.from('point_transactions').insert({
      business_id: staff.business_id,
      customer_id: customerId,
      type: 'spend',
      points: -points,
      source: 'redemption',
      description,
    }),
  ])

  await logAuditServer({
    businessId: staff.business_id,
    staffId: staff.id,
    staffName: staff.name,
    action: 'update',
    resource: 'customer',
    resourceId: customerId,
    details: { type: 'loyalty_spend', pointsSpent: points, newBalance, description },
  })

  return NextResponse.json({ ok: true, pointsSpent: points, newBalance })
}
