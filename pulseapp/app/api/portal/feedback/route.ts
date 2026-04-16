import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'

const VALID_TYPES = new Set(['suggestion', 'complaint', 'praise', 'question'])

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

  const body = await request.json().catch(() => null)
  if (!body || typeof body.type !== 'string' || !VALID_TYPES.has(body.type)) {
    return NextResponse.json({ error: 'Geçerli bir tip seçin' }, { status: 400 })
  }
  const message: string = typeof body.message === 'string' ? body.message.trim() : ''
  if (!message || message.length < 5) {
    return NextResponse.json({ error: 'Mesaj en az 5 karakter olmalı' }, { status: 400 })
  }
  const subject: string | null = typeof body.subject === 'string' ? body.subject.trim().slice(0, 200) || null : null

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
      type: body.type,
      subject,
      message: message.slice(0, 4000),
      status: 'open',
      source: 'portal',
    })
    .select('id, type, subject, message, status, created_at')
    .single()

  if (error) {
    console.error('[portal/feedback] insert error', error)
    return NextResponse.json({ error: 'Geri bildirim kaydedilemedi' }, { status: 500 })
  }

  return NextResponse.json({ feedback: created })
}
