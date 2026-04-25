import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalReviewCreateSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'
import { logPortalAction, getClientIp } from '@/lib/portal/audit'

const log = createLogger({ route: 'api/portal/reviews' })

/**
 * GET — Müşterinin yazdığı yorumlar + yorum bekleyen randevular.
 * ?tab=my (default): müşterinin kendi yorumları + yorum bekleyen randevular
 * ?tab=business: tüm yayınlanmış işletme yorumları (anonim olanlar ad olmadan)
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { searchParams } = new URL(request.url)
  const tab = searchParams.get('tab') === 'business' ? 'business' : 'my'

  if (tab === 'business') {
    // İnceleme altındaki yorumlar (escalated) gizlenir; diğer müşterilerin yorumları görünür
    const { data: businessReviews } = await admin
      .from('reviews')
      .select('id, rating, comment, created_at, is_anonymous, customer_id, customers(name)')
      .eq('business_id', businessId)
      .neq('status', 'escalated')
      .order('created_at', { ascending: false })
      .limit(100)

    const normalized = (businessReviews || []).map((r: any) => ({
      id: r.id,
      rating: r.rating,
      comment: r.comment,
      created_at: r.created_at,
      author_name: r.is_anonymous ? 'Anonim' : (r.customers?.name || 'Müşteri'),
      is_mine: r.customer_id === customerId,
    }))

    return NextResponse.json({ reviews: normalized, tab: 'business' })
  }

  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const thirtyIso = thirtyDaysAgo.toISOString().split('T')[0]

  const [reviewsRes, completedRes] = await Promise.all([
    admin
      .from('reviews')
      .select('id, rating, comment, status, created_at, appointment_id, actual_response, is_anonymous')
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
    tab: 'my',
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

  const parsed = await validateBody(request, portalReviewCreateSchema)
  if (!parsed.ok) return parsed.response
  const { rating, comment = null, appointmentId = null, isAnonymous: isAnonymousRaw } = parsed.data
  // Varsayılan: anonim. Kullanıcı explicit false geçerse adıyla paylaşılır.
  const isAnonymous = isAnonymousRaw === false ? false : true

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
      rating,
      comment,
      status: 'pending',
      google_review_link_sent: false,
      is_anonymous: isAnonymous,
    })
    .select('id, rating, comment, status, created_at, appointment_id, is_anonymous')
    .single()

  if (error) {
    log.error({ err: error, businessId, customerId, appointmentId }, 'Yorum kaydedilemedi')
    return NextResponse.json({ error: 'Yorum kaydedilemedi' }, { status: 500 })
  }

  try {
    await admin.from('notifications').insert({
      business_id: businessId,
      type: 'review',
      title: 'Yeni Yorum',
      body: `${rating} yıldız${comment ? ` — "${comment.slice(0, 60)}"` : ''}`,
      related_id: created.id,
      related_type: 'review',
      is_read: false,
    })
  } catch { /* bildirim hatası yorum kaydını etkilemez */ }

  await logPortalAction({
    customerId,
    businessId,
    action: 'review_submitted',
    resource: 'review',
    resourceId: created.id,
    details: { rating, hasComment: !!comment, isAnonymous, appointmentId },
    ipAddress: getClientIp(request),
  })

  return NextResponse.json({ review: created })
}
