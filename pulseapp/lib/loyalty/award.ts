import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Sadakat puanı verme — tahsilat tamamlandığında çağrılır.
 * Idempotent: aynı reference_id (genelde appointment_id) için ikinci kez puan eklenmez.
 *
 * Çağrı noktaları:
 * - /api/invoices/payments POST: fatura ilk kez 'paid' durumuna geçtiğinde
 * - /api/pos POST: kasa işlemi 'paid' durumunda oluşturulduğunda (appointment_id varsa)
 *
 * Eski davranış (randevu 'completed' olunca puan ekleme) artık kullanılmıyor —
 * tahsilatsız randevular sadakat puanı kazanmamalı.
 */
export async function awardPointsForAppointment(
  admin: SupabaseClient,
  params: {
    businessId: string
    customerId: string
    appointmentId: string  // reference_id olarak kullanılır
    revenueAmount: number  // ödenen tutar (paid_amount tabanlı)
  },
): Promise<{ awarded: boolean; pointsAdded?: number; thresholdCrossed?: boolean }> {
  const { businessId, customerId, appointmentId, revenueAmount } = params

  // İşletme ayarlarını al — sistem kapalıysa hiçbir şey yapma
  const { data: biz } = await admin
    .from('businesses')
    .select('settings')
    .eq('id', businessId)
    .single()

  const settings = biz?.settings as Record<string, unknown> | null
  if (!settings?.loyalty_enabled) return { awarded: false }

  const pointsPerCurrency = (settings.points_per_currency as number) ?? 1
  const visitBonus = (settings.visit_bonus_points as number) ?? 50
  const autoRewardThreshold = (settings.auto_reward_threshold as number) ?? 500

  // Idempotency — aynı randevu için earn kaydı varsa erken çık
  const { data: existing } = await admin
    .from('point_transactions')
    .select('id')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('reference_id', appointmentId)
    .eq('type', 'earn')
    .in('source', ['appointment', 'visit_bonus'])
    .limit(1)
  if (existing && existing.length > 0) return { awarded: false }

  const earnedFromRevenue = Math.floor(revenueAmount * pointsPerCurrency)
  const totalEarned = earnedFromRevenue + visitBonus
  if (totalEarned <= 0) return { awarded: false }

  // Mevcut bakiye → upsert
  const { data: cur } = await admin
    .from('loyalty_points')
    .select('*')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .maybeSingle()

  const oldBalance = cur?.points_balance ?? 0
  const newBalance = oldBalance + totalEarned

  await admin.from('loyalty_points').upsert(
    {
      business_id: businessId,
      customer_id: customerId,
      points_balance: newBalance,
      total_earned: (cur?.total_earned ?? 0) + totalEarned,
      total_spent: cur?.total_spent ?? 0,
    },
    { onConflict: 'business_id,customer_id' },
  )

  const txRows: Record<string, unknown>[] = []
  if (earnedFromRevenue > 0) {
    txRows.push({
      business_id: businessId,
      customer_id: customerId,
      type: 'earn',
      points: earnedFromRevenue,
      source: 'appointment',
      reference_id: appointmentId,
      description: `Tahsilat puanı (${revenueAmount}₺ × ${pointsPerCurrency})`,
    })
  }
  txRows.push({
    business_id: businessId,
    customer_id: customerId,
    type: 'earn',
    points: visitBonus,
    source: 'visit_bonus',
    reference_id: appointmentId,
    description: 'Ziyaret bonusu',
  })
  await admin.from('point_transactions').insert(txRows)

  const thresholdCrossed = oldBalance < autoRewardThreshold && newBalance >= autoRewardThreshold
  return { awarded: true, pointsAdded: totalEarned, thresholdCrossed }
}

/**
 * Sadakat puanı geri alma — iade veya randevu revert'inde çağrılır.
 * Harcanmış puan varsa { ok: false, reason: 'points_already_spent' } döner.
 */
export async function revertPointsForAppointment(
  admin: SupabaseClient,
  params: {
    businessId: string
    customerId: string
    appointmentId: string
  },
): Promise<
  | { ok: true; pointsReverted: number }
  | { ok: false; reason: 'points_already_spent'; pointsToRevert: number; currentBalance: number }
> {
  const { businessId, customerId, appointmentId } = params

  const { data: txs } = await admin
    .from('point_transactions')
    .select('id, points')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('reference_id', appointmentId)
    .eq('type', 'earn')
    .in('source', ['appointment', 'visit_bonus'])

  if (!txs || txs.length === 0) {
    return { ok: true, pointsReverted: 0 }
  }

  const totalPoints = txs.reduce((sum, t) => sum + (t.points || 0), 0)

  const { data: loy } = await admin
    .from('loyalty_points')
    .select('id, points_balance, total_earned')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .single()

  if (loy && (loy.points_balance ?? 0) < totalPoints) {
    return {
      ok: false,
      reason: 'points_already_spent',
      pointsToRevert: totalPoints,
      currentBalance: loy.points_balance ?? 0,
    }
  }

  if (loy) {
    await admin
      .from('loyalty_points')
      .update({
        points_balance: Math.max(0, (loy.points_balance ?? 0) - totalPoints),
        total_earned: Math.max(0, (loy.total_earned ?? 0) - totalPoints),
      })
      .eq('id', loy.id)
  }

  await admin
    .from('point_transactions')
    .delete()
    .in('id', txs.map(t => t.id))

  return { ok: true, pointsReverted: totalPoints }
}
