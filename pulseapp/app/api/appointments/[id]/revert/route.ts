import { NextRequest, NextResponse } from 'next/server'
import { requireWritePermission } from '@/lib/api/with-permission'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revertPointsForAppointment } from '@/lib/loyalty/award'

/**
 * POST /api/appointments/[id]/revert
 *
 * "Tamamlandı"yı geri al — atomik akış:
 *   1. Status guard: status='completed' WHERE status='completed' (concurrency)
 *   2. (refund=true ve fatura ödenmişse) iade kaydı + fatura sıfırlama
 *   3. Paket seansı geri al (atomic RPC)
 *   4. Sadakat puanı geri al (refund=false ise eski sistemden gelmiş puanlar için)
 *   5. Audit log
 *
 * Hata yönetimi: status update başarılı ama refund başarısız olursa →
 * status COMPLETED'a geri çevrilir (rollback). Bu sayede client-side handle
 * etmediğimiz tutarsızlık yaratılmaz.
 *
 * Body: { refund: boolean }
 * Response: { ok: true, pointsReverted?, loyaltyWarning? }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const auth = await requireWritePermission(request, 'appointments')
  if (!auth.ok) return auth.response
  const { businessId, staffId, staffName } = auth.ctx
  const supabase = createServerSupabaseClient()
  const admin = createAdminClient()

  // Body validation
  let body: { refund?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek gövdesi' }, { status: 400 })
  }
  const refund = body.refund === true

  // 1. Randevuyu çek + cross-tenant filtre
  const { data: apt, error: aptErr } = await supabase
    .from('appointments')
    .select('id, business_id, customer_id, customer_package_id, status')
    .eq('id', params.id)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .single()

  if (aptErr || !apt) {
    return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
  }
  if (apt.status !== 'completed') {
    return NextResponse.json({
      error: 'Randevu zaten tamamlandı durumunda değil',
    }, { status: 409 })
  }

  // 2. Paid invoice'u çek (refund öncesi gerekecek)
  let paidInvoice: { id: string; paid_amount: number; total: number } | null = null
  {
    const { data: inv } = await supabase
      .from('invoices')
      .select('id, paid_amount, total')
      .eq('appointment_id', params.id)
      .eq('business_id', businessId)
      .is('deleted_at', null)
      .gt('paid_amount', 0)
      .maybeSingle()
    if (inv) {
      paidInvoice = {
        id: inv.id,
        paid_amount: Number(inv.paid_amount),
        total: Number(inv.total),
      }
    }
  }

  // 3. Status update — concurrency guard ile atomik
  const { data: updatedRows, error: statusErr } = await supabase
    .from('appointments')
    .update({ status: 'confirmed' })
    .eq('id', params.id)
    .eq('business_id', businessId)
    .eq('status', 'completed')
    .select('id')

  if (statusErr) {
    return NextResponse.json({ error: statusErr.message }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({
      error: 'Randevu durumu bu arada başka bir kullanıcı tarafından değiştirildi',
    }, { status: 409 })
  }

  // ROLLBACK helper — sonraki adımlardan biri kritik şekilde başarısız olursa status'u geri al
  async function rollbackStatus(reason: string) {
    await admin
      .from('appointments')
      .update({ status: 'completed' })
      .eq('id', params.id)
      .eq('business_id', businessId)
    return NextResponse.json({ error: reason }, { status: 500 })
  }

  // 4. Refund — refund=true ve paid invoice varsa
  if (refund && paidInvoice) {
    const refundAmount = paidInvoice.paid_amount

    // Refund kaydı ekle (negatif değer ile)
    const { error: payErr } = await admin.from('invoice_payments').insert({
      invoice_id: paidInvoice.id,
      business_id: businessId,
      amount: -refundAmount,  // negatif = iade
      method: 'cash',
      payment_type: 'refund',
      staff_id: staffId,
      staff_name: staffName,
      notes: 'Tamamlandı geri alma — randevu revert',
    })
    if (payErr) {
      return rollbackStatus('İade kaydı oluşturulamadı: ' + payErr.message)
    }

    // Fatura paid_amount ve status'u güncelle
    const newPaid = Math.max(0, paidInvoice.paid_amount - refundAmount)
    const newStatus = newPaid >= paidInvoice.total
      ? 'paid'
      : (newPaid > 0 ? 'partial' : 'pending')
    const { error: invErr } = await admin
      .from('invoices')
      .update({ paid_amount: newPaid, status: newStatus })
      .eq('id', paidInvoice.id)
      .eq('business_id', businessId)
    if (invErr) {
      return rollbackStatus('Fatura güncellenemedi: ' + invErr.message)
    }
  }

  // 5. Paket seansı geri al — atomik RPC
  if (apt.customer_package_id) {
    await admin.rpc('decrement_package_session', {
      p_package_id: apt.customer_package_id,
      p_business_id: businessId,
    })
    // package_usages kaydını sil
    await admin
      .from('package_usages')
      .delete()
      .eq('appointment_id', params.id)
      .eq('business_id', businessId)
  }

  // 6. Sadakat puanı geri al — refund=true ise refund endpoint zaten geri aldı,
  //    refund=false ise eski sistemden gelmiş puanları geri al (idempotent helper kullan).
  let pointsReverted = 0
  let loyaltyWarning: string | null = null
  if (apt.customer_id && !refund) {
    const result = await revertPointsForAppointment(admin, {
      businessId,
      customerId: apt.customer_id,
      appointmentId: params.id,
    })
    if (result.ok) {
      pointsReverted = result.pointsReverted
    } else if (result.reason === 'points_already_spent') {
      loyaltyWarning = `Müşteri ${result.pointsToRevert} puanın bir kısmını harcamış (bakiye: ${result.currentBalance}). Sadakat puanı manuel düzeltilmeli.`
    }
  }

  // 7. Audit log
  await admin.from('audit_logs').insert({
    business_id: businessId,
    staff_id: staffId,
    staff_name: staffName,
    action: 'status_change',
    resource: 'appointment',
    resource_id: params.id,
    actor_type: 'staff',
    actor_id: staffId,
    details: {
      from: 'completed',
      to: 'confirmed',
      revert: true,
      refunded: refund && !!paidInvoice,
      refund_amount: refund && paidInvoice ? paidInvoice.paid_amount : 0,
      points_reverted: pointsReverted,
    },
  })

  return NextResponse.json({
    ok: true,
    pointsReverted,
    loyaltyWarning,
    refunded: refund && !!paidInvoice,
  })
}
