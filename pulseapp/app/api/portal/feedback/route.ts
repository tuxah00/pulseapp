import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { validateBody } from '@/lib/api/validate'
import { portalFeedbackCreateSchema } from '@/lib/schemas'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/feedback' })

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('feedback')
    .select('id, type, subject, message, status, response, responded_at, created_at')
    .eq('business_id', businessId)
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Geri bildirimler alınamadı' }, { status: 500 })
  }

  return NextResponse.json({ feedback: data || [] })
}

export async function POST(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const parsed = await validateBody(request, portalFeedbackCreateSchema)
  if (!parsed.ok) return parsed.response
  const { type, message, subject = null } = parsed.data

  const admin = createAdminClient()

  // Müşteri adı ve telefon bilgilerini çek
  const { data: customer } = await admin
    .from('customers')
    .select('name, phone')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  const { data: created, error } = await admin
    .from('feedback')
    .insert({
      business_id: businessId,
      customer_id: customerId,
      customer_name: customer?.name || null,
      customer_phone: customer?.phone || null,
      type,
      subject,
      message,
      status: 'open',
      source: 'portal',
    })
    .select('id, type, subject, message, status, created_at')
    .single()

  if (error) {
    log.error({ err: error, businessId, customerId }, 'Geri bildirim kaydedilemedi')
    return NextResponse.json({ error: 'Geri bildirim kaydedilemedi' }, { status: 500 })
  }

  const TYPE_LABELS: Record<string, string> = {
    suggestion: 'Öneri', complaint: 'Şikayet', praise: 'Teşekkür', question: 'Soru',
  }
  try {
    await admin.from('notifications').insert({
      business_id: businessId,
      type: 'feedback',
      title: 'Yeni Geri Bildirim',
      body: `${customer?.name || 'Müşteri'} — ${TYPE_LABELS[body.type] ?? body.type}${subject ? `: ${subject.slice(0, 60)}` : ''}`,
      related_id: created.id,
      related_type: 'feedback',
      is_read: false,
    })
  } catch { /* bildirim hatası feedback kaydını etkilemez */ }

  return NextResponse.json({ feedback: created })
}
