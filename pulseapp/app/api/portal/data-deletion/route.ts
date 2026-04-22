import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalDataDeletionSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/data-deletion' })

/**
 * Mevcut aktif silme talebini döndür (varsa).
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('data_deletion_requests')
    .select('id, status, reason, reason_category, scheduled_deletion_at, requested_at, processed_at')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .in('status', ['pending', 'processing'])
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return NextResponse.json({ error: 'Talep bilgisi alınamadı' }, { status: 500 })
  }

  return NextResponse.json({ request: data || null })
}

/**
 * Yeni silme talebi oluştur. 30 gün sonra için zamanla.
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalDataDeletionSchema)
  if (!parsed.ok) return parsed.response
  const { reasonCategory = null, reason = null } = parsed.data

  const admin = createAdminClient()

  // Aktif bir talebin zaten olup olmadığını kontrol et
  const { data: existing } = await admin
    .from('data_deletion_requests')
    .select('id, status')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ error: 'Zaten aktif bir silme talebin var' }, { status: 409 })
  }

  // Müşteri adı/telefon çek
  const { data: customer } = await admin
    .from('customers')
    .select('name, phone')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  const scheduledDeletionAt = new Date()
  scheduledDeletionAt.setDate(scheduledDeletionAt.getDate() + 30)

  const { data: created, error } = await admin
    .from('data_deletion_requests')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
      status: 'pending',
      reason,
      reason_category: reasonCategory,
      scheduled_deletion_at: scheduledDeletionAt.toISOString(),
      source: 'portal',
    })
    .select('id, status, scheduled_deletion_at, reason_category, requested_at')
    .single()

  if (error) {
    log.error({ err: error, businessId, customerId, phase: 'insert' }, 'Silme talebi oluşturulamadı')
    return NextResponse.json({ error: 'Talep oluşturulamadı' }, { status: 500 })
  }

  return NextResponse.json({ request: created })
}

/**
 * Bekleyen talebi iptal et.
 */
export async function DELETE(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  const { data: existing } = await admin
    .from('data_deletion_requests')
    .select('id, status')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .eq('status', 'pending')
    .order('requested_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Aktif talep bulunamadı' }, { status: 404 })
  }

  const { error } = await admin
    .from('data_deletion_requests')
    .update({ status: 'cancelled', processed_at: new Date().toISOString() })
    .eq('id', existing.id)

  if (error) {
    log.error({ err: error, businessId, customerId, phase: 'cancel' }, 'Silme talebi iptal edilemedi')
    return NextResponse.json({ error: 'Talep iptal edilemedi' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
