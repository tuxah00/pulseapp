import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'

// POST — OTP atlamadan doğrudan müşteri girişi (SMS servisi aktif olana kadar)
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { businessId, phone } = body

  if (!businessId || !phone) {
    return NextResponse.json({ error: 'businessId ve telefon numarası zorunludur' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  const admin = createAdminClient()

  // İşletme ve müşteri sorgularını paralel çalıştır
  const [bizResult, customerResult] = await Promise.all([
    admin.from('businesses').select('id').eq('id', businessId).single(),
    admin.from('customers').select('id, name, phone, segment, birthday')
      .eq('business_id', businessId)
      .or(phoneOrFilter(normalizedPhone))
      .eq('is_active', true)
      .limit(1),
  ])

  if (!bizResult.data) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const customer = customerResult.data?.[0] || null

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
