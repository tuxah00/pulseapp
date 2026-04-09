import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePermission } from '@/lib/api/with-permission'
import { createPaytrToken, getPlanPriceKurus } from '@/lib/billing/paytr'

// POST: PayTR ödeme token'ı oluştur
export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'settings')
  if (!auth.ok) return auth.response
  const { businessId } = auth.ctx

  const body = await req.json()
  const { plan } = body // 'starter' | 'standard' | 'pro'

  if (!plan || !['starter', 'standard', 'pro'].includes(plan)) {
    return NextResponse.json({ error: 'Geçerli bir plan seçin' }, { status: 400 })
  }

  if (!process.env.PAYTR_MERCHANT_ID) {
    return NextResponse.json({
      error: 'PayTR yapılandırılmamış. PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT env değişkenlerini ekleyin.',
    }, { status: 503 })
  }

  const admin = createAdminClient()
  const { data: business } = await admin
    .from('businesses')
    .select('name, email, phone, address, city')
    .eq('id', businessId)
    .single()

  if (!business) return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })

  const merchantOid = `SUB-${plan}-${businessId}-${Date.now()}`
  const priceKurus = getPlanPriceKurus(plan)

  const ip = req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    '127.0.0.1'

  try {
    const result = await createPaytrToken({
      merchantOid,
      email: business.email || 'info@pulseapp.com',
      paymentAmountKurus: priceKurus,
      userName: business.name,
      userAddress: [business.address, business.city].filter(Boolean).join(', ') || 'Türkiye',
      userPhone: business.phone || '05000000000',
      userIp: ip.split(',')[0].trim(),
      testMode: process.env.NODE_ENV !== 'production',
    })

    // Pending payment kaydı oluştur
    await admin.from('payments').insert({
      business_id: businessId,
      merchant_oid: merchantOid,
      plan_type: plan,
      amount: priceKurus / 100,
      currency: 'TRY',
      status: 'pending',
    }).then(() => {}) // hata olsa da devam et

    return NextResponse.json({ iframeUrl: result.iframeUrl, merchantOid })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'PayTR bağlantı hatası'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
