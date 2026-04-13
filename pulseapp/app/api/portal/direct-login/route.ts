import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

// POST — OTP atlamadan doğrudan müşteri girişi (SMS servisi aktif olana kadar)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { businessId, phone } = body

  if (!businessId || !phone) {
    return NextResponse.json({ error: 'businessId ve telefon numarası zorunludur' }, { status: 400 })
  }

  // Telefon normalizasyonu: 5XXXXXXXXX formatına çevir
  let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
  if (normalizedPhone.startsWith('+90')) normalizedPhone = normalizedPhone.slice(3)
  if (normalizedPhone.startsWith('90') && normalizedPhone.length > 10) normalizedPhone = normalizedPhone.slice(2)
  if (normalizedPhone.startsWith('0')) normalizedPhone = normalizedPhone.slice(1)

  const admin = createAdminClient()

  // İşletmenin var olduğunu doğrula
  const { data: biz } = await admin
    .from('businesses')
    .select('id')
    .eq('id', businessId)
    .single()

  if (!biz) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  // Müşteriyi bul (tüm olası telefon formatlarını kontrol et)
  const { data: customers } = await admin
    .from('customers')
    .select('id, name, phone, segment, birthday')
    .eq('business_id', businessId)
    .or(`phone.eq.${normalizedPhone},phone.eq.0${normalizedPhone},phone.eq.+90${normalizedPhone}`)
    .eq('is_active', true)
    .limit(1)

  const customer = customers?.[0] || null

  if (!customer) {
    return NextResponse.json({ error: 'Bu telefon numarasıyla kayıtlı müşteri bulunamadı' }, { status: 404 })
  }

  // Cookie oluştur — doğrudan giriş
  const response = NextResponse.json({
    success: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      segment: customer.segment,
    },
  })

  response.cookies.set('portal_customer_id', customer.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  response.cookies.set('portal_business_id', businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
  })

  return response
}
