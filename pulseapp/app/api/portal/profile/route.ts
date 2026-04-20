import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { isValidCustomerBirthday } from '@/lib/utils/birthday'
import { MSG } from '@/lib/schemas/messages'

const ALLOWED_CHANNELS = new Set(['sms', 'whatsapp', 'auto'])

export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customers')
    .select('id, name, phone, email, birthday, preferred_channel, notes, segment, total_visits')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 404 })
  }

  return NextResponse.json({ profile: data })
}

export async function PATCH(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Geçersiz veri' }, { status: 400 })
  }

  const updates: Record<string, any> = {}

  if (typeof body.name === 'string') {
    const name = body.name.trim()
    if (name.length < 2 || name.length > 200) {
      return NextResponse.json({ error: 'İsim 2-200 karakter olmalı' }, { status: 400 })
    }
    updates.name = name
  }

  if (body.email !== undefined) {
    if (body.email === null || body.email === '') {
      updates.email = null
    } else if (typeof body.email === 'string') {
      const email = body.email.trim()
      // Minimal email kontrolü
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return NextResponse.json({ error: 'Geçerli bir e-posta girin' }, { status: 400 })
      }
      updates.email = email
    }
  }

  if (body.birthday !== undefined) {
    if (body.birthday === null || body.birthday === '') {
      updates.birthday = null
    } else if (typeof body.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.birthday)) {
      if (!isValidCustomerBirthday(body.birthday)) {
        return NextResponse.json({ error: MSG.BIRTHDAY_MIN_AGE }, { status: 400 })
      }
      updates.birthday = body.birthday
    } else {
      return NextResponse.json({ error: 'Doğum tarihi YYYY-AA-GG formatında olmalı' }, { status: 400 })
    }
  }

  if (body.preferred_channel !== undefined) {
    if (body.preferred_channel === null) {
      updates.preferred_channel = null
    } else if (typeof body.preferred_channel === 'string' && ALLOWED_CHANNELS.has(body.preferred_channel)) {
      updates.preferred_channel = body.preferred_channel
    } else {
      return NextResponse.json({ error: 'Geçersiz iletişim tercihi' }, { status: 400 })
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Güncellenecek alan yok' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('customers')
    .update(updates)
    .eq('id', customerId)
    .eq('business_id', businessId)
    .select('id, name, phone, email, birthday, preferred_channel, segment, total_visits')
    .single()

  if (error) {
    console.error('[portal/profile] update error', error)
    return NextResponse.json({ error: 'Profil güncellenemedi' }, { status: 500 })
  }

  return NextResponse.json({ profile: data })
}
