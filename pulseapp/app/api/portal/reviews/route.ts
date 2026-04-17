import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

/**
 * GET — Müşterinin yazdığı yorumlar + yorum bekleyen tamamlanmış randevular.
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyIso = thirtyDaysAgo.toISOString().split('T')[0]

  const [reviewsRes, completedRes] = await Promise.all([
    admin
      .from('reviews')
      .select('id, rating, comment, status, created_at, appointment_id, actual_response')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false }),
    admin
      .from('appointments')
      .select('id, appointment_date, start_time, services(id, name), staff_members(id, name)')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .eq('status', 'completed')
      .gte('appointment_date', thirtyIso)
      .is('deleted_at', null)
      .order('appointment_date', { ascending: false })
      .limit(20),
  ])

  const reviewedIds = new Set((reviewsRes.data || []).map((r: any) => r.appointment_id).filter(Boolean))
  const pending = (completedRes.data || []).filter((a: any) => !reviewedIds.has(a.id))

  return NextResponse.json({
    reviews: reviewsRes.data || [],
    pendingAppointments: pending,
  })
}

/**
 * POST — Yeni yorum gönder.
 * body: { appointmentId?, rating: number, comment?: string }
 */
export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const body = await request.json().catch(() => null)
  if (!body || typeof body.rating !== 'number' || body.rating < 1 || body.rating > 5) {
    return NextResponse.json({ error: 'Geçerli bir puan (1-5) girmelisiniz' }, { status: 400 })
  }

  const comment: string | null = typeof body.comment === 'string' ? body.comment.trim().slice(0, 2000) : null
  const appointmentId: string | null = typeof body.appointmentId === 'string' ? body.appointmentId : null

  const admin = createAdminClient()

  // Eğer randevuya yorum veriliyorsa, randevunun bu müşteriye ait olduğunu doğrula
  if (appointmentId) {
    const { data: apt } = await admin
      .from('appointments')
      .select('id')
      .eq('id', appointmentId)
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .single()
    if (!apt) {
      return NextResponse.json({ error: 'Randevu bulunamadı' }, { status: 404 })
    }

    // Aynı randevuya yorum varsa engelle
    const { data: existing } = await admin
      .from('reviews')
      .select('id')
      .eq('business_id', businessId)
      .eq('appointment_id', appointmentId)
      .maybeSingle()
    if (existing) {
      return NextResponse.json({ error: 'Bu randevuya zaten yorum yaptınız' }, { status: 409 })
    }
  }

  const { data: created, error } = await admin
    .from('reviews')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      appointment_id: appointmentId,
      rating: body.rating,
      comment,
      status: 'pending',
      google_review_link_sent: false,
    })
    .select('id, rating, comment, status, created_at, appointment_id')
    .single()

  if (error) {
    console.error('[portal/reviews] insert error', error)
    return NextResponse.json({ error: 'Yorum kaydedilemedi' }, { status: 500 })
  }

  return NextResponse.json({ review: created })
}
