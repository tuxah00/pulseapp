import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'

function generateOTP(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

// POST — OTP üret ve gönder
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { businessId, phone } = body

  if (!businessId || !phone) {
    return NextResponse.json({ error: 'businessId ve telefon numarası zorunludur' }, { status: 400 })
  }

  // Telefon normalizasyonu: +90/0 prefix'lerini kaldır → 5XXXXXXXXX formatına çevir
  let normalizedPhone = phone.replace(/[\s\-\(\)]/g, '')
  if (normalizedPhone.startsWith('+90')) normalizedPhone = normalizedPhone.slice(3)
  if (normalizedPhone.startsWith('90') && normalizedPhone.length > 10) normalizedPhone = normalizedPhone.slice(2)
  if (normalizedPhone.startsWith('0')) normalizedPhone = normalizedPhone.slice(1)

  const admin = createAdminClient()

  // İşletmenin var olduğunu doğrula
  const { data: business } = await admin
    .from('businesses')
    .select('id, name')
    .eq('id', businessId)
    .single()

  if (!business) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  // Müşterinin bu işletmede kayıtlı olduğunu doğrula (tüm telefon formatları)
  const { data: customers } = await admin
    .from('customers')
    .select('id, name, phone')
    .eq('business_id', businessId)
    .or(`phone.eq.${normalizedPhone},phone.eq.0${normalizedPhone},phone.eq.+90${normalizedPhone}`)
    .eq('is_active', true)
    .limit(1)

  const customer = customers?.[0] || null

  if (!customer) {
    return NextResponse.json({ error: 'Bu telefon numarasıyla kayıtlı müşteri bulunamadı' }, { status: 404 })
  }

  // Son 1 dakika içinde gönderilmiş OTP var mı? (rate limit)
  const oneMinAgo = new Date(Date.now() - 60 * 1000).toISOString()
  const { data: recentOtp } = await admin
    .from('portal_otps')
    .select('id, created_at')
    .eq('business_id', businessId)
    .eq('phone', normalizedPhone)
    .eq('used', false)
    .gte('created_at', oneMinAgo)
    .single()

  if (recentOtp) {
    return NextResponse.json({ error: 'Lütfen 1 dakika bekleyip tekrar deneyin' }, { status: 429 })
  }

  // OTP oluştur
  const otp = generateOTP()
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 dakika

  // Eski OTP'leri geçersiz kıl
  await admin
    .from('portal_otps')
    .update({ used: true })
    .eq('business_id', businessId)
    .eq('phone', normalizedPhone)
    .eq('used', false)

  // Yeni OTP kaydet
  const { error: insertError } = await admin
    .from('portal_otps')
    .insert({
      business_id: businessId,
      phone: normalizedPhone,
      otp,
      expires_at: expiresAt,
    })

  if (insertError) {
    return NextResponse.json({ error: 'OTP oluşturulamadı' }, { status: 500 })
  }

  // SMS gönder
  const smsMessage = `${business.name} müşteri portalı giriş kodunuz: ${otp} (10 dakika geçerli)`

  try {
    await sendMessage({
      to: normalizedPhone,
      body: smsMessage,
      businessId,
      customerId: customer.id,
      messageType: 'system',
      channel: 'sms',
    })
  } catch (err) {
    console.error('Portal OTP SMS gönderilemedi:', err)
    // SMS gönderilemese bile devam et (geliştirme ortamında)
  }

  return NextResponse.json({ success: true, message: `${normalizedPhone} numarasına doğrulama kodu gönderildi` })
}
