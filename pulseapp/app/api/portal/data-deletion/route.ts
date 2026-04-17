import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

const VALID_REASONS = new Set(['not_using', 'privacy_concern', 'switched_provider', 'dissatisfied', 'other'])

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

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
  }

  const reasonCategory: string | null = typeof body.reasonCategory === 'string' && VALID_REASONS.has(body.reasonCategory)
    ? body.reasonCategory
    : null
  const reason: string | null = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) || null : null
  const confirmation: string = typeof body.confirmation === 'string' ? body.confirmation.trim() : ''

  // Güvenlik onayı — kullanıcı "VERİLERİMİ SİL" yazmalı
  if (confirmation !== 'VERİLERİMİ SİL') {
    return NextResponse.json({ error: 'Onay metnini doğru yazmalısın' }, { status: 400 })
  }

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
    console.error('[portal/data-deletion] insert error', error)
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
    console.error('[portal/data-deletion] cancel error', error)
    return NextResponse.json({ error: 'Talep iptal edilemedi' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
