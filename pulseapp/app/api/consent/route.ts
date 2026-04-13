import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { logAuditServer } from '@/lib/utils/audit'

// POST: Rıza kaydı oluştur (public — randevu formu vb. için kimlik doğrulama gerekmez)
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { businessId, customerId, customerPhone, consentType, method, ipAddress, notes } = body

  if (!businessId || !consentType || !method) {
    return NextResponse.json({ error: 'businessId, consentType, method zorunlu' }, { status: 400 })
  }

  const validTypes = ['kvkk', 'marketing', 'health_data', 'whatsapp']
  const validMethods = ['online_form', 'in_person', 'phone', 'whatsapp']

  if (!validTypes.includes(consentType)) {
    return NextResponse.json({ error: 'Geçersiz consentType' }, { status: 400 })
  }
  if (!validMethods.includes(method)) {
    return NextResponse.json({ error: 'Geçersiz method' }, { status: 400 })
  }

  const admin = createAdminClient()
  const ip = ipAddress || req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || null

  const { data, error } = await admin
    .from('consent_records')
    .insert({
      business_id: businessId,
      customer_id: customerId || null,
      customer_phone: customerPhone || null,
      consent_type: consentType,
      method,
      ip_address: ip,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await logAuditServer({
    businessId,
    staffId: null,
    staffName: null,
    action: 'create',
    resource: 'consent',
    resourceId: data.id,
    details: { consent_type: consentType, method, customer_phone: customerPhone || null },
    ipAddress: ip,
  })

  // Müşteri kaydında kvkk_consent_given'ı güncelle
  if (customerId && consentType === 'kvkk') {
    await admin
      .from('customers')
      .update({ kvkk_consent_given: true, kvkk_consent_given_at: new Date().toISOString() })
      .eq('id', customerId)
      .eq('business_id', businessId)
      .eq('is_active', true)
  }

  return NextResponse.json({ consent: data }, { status: 201 })
}

// GET: Müşterinin rıza durumunu sorgula
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const businessId = searchParams.get('businessId')
  const customerId = searchParams.get('customerId')
  const customerPhone = searchParams.get('phone')

  if (!businessId || (!customerId && !customerPhone)) {
    return NextResponse.json({ error: 'businessId ve customerId veya phone zorunlu' }, { status: 400 })
  }

  const admin = createAdminClient()
  let query = admin
    .from('consent_records')
    .select('*')
    .eq('business_id', businessId)
    .is('revoked_at', null)
    .order('given_at', { ascending: false })

  if (customerId) query = query.eq('customer_id', customerId)
  else if (customerPhone) query = query.eq('customer_phone', customerPhone)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const consents = {
    kvkk: data?.some(c => c.consent_type === 'kvkk') ?? false,
    marketing: data?.some(c => c.consent_type === 'marketing') ?? false,
    health_data: data?.some(c => c.consent_type === 'health_data') ?? false,
    whatsapp: data?.some(c => c.consent_type === 'whatsapp') ?? false,
    records: data ?? [],
  }

  return NextResponse.json(consents)
}

// DELETE: Veri silme/anonimleştirme talebi oluştur
export async function DELETE(req: NextRequest) {
  const body = await req.json()
  const { businessId, customerId, customerName, customerPhone, notes } = body

  if (!businessId) {
    return NextResponse.json({ error: 'businessId zorunlu' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data, error } = await admin
    .from('data_deletion_requests')
    .insert({
      business_id: businessId,
      customer_id: customerId || null,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || null
  await logAuditServer({
    businessId,
    staffId: null,
    staffName: null,
    action: 'request',
    resource: 'data_deletion_request',
    resourceId: data.id,
    details: { customer_name: customerName || null, customer_phone: customerPhone || null, notes: notes || null },
    ipAddress: ip,
  })

  return NextResponse.json({ request: data }, { status: 201 })
}
