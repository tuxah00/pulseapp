import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendMessage } from '@/lib/messaging/send'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { isValidUUID } from '@/lib/utils/validate'
import crypto from 'crypto'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/otp' })

function generateOTP(): string {
  // crypto.randomInt kriptografik olarak güvenli
  return String(crypto.randomInt(100000, 1000000))
}

// POST — OTP üret ve gönder
export async function POST(request: NextRequest) {
  // IP bazlı rate limit — SMS bombing koruması
  const rl = checkRateLimit(request, RATE_LIMITS.auth)
  if (rl.limited) return rl.response

  const body = await request.json()
  const { businessId, phone } = body

  if (!businessId || !phone || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'businessId ve telefon numarası zorunludur' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  const admin = createAdminClient()

  // İşletme ve müşteri sorgularını paralel çalıştır
  const [bizResult, customerResult] = await Promise.all([
    admin.from('businesses').select('id, name').eq('id', businessId).single(),
    admin.from('customers').select('id, name, phone')
      .eq('business_id', businessId)
      .or(phoneOrFilter(normalizedPhone))
      .eq('is_active', true)
      .limit(1),
  ])

  if (!bizResult.data) {
    return NextResponse.json({ error: 'İşletme bulunamadı' }, { status: 404 })
  }

  const business = bizResult.data
  const customer = customerResult.data?.[0] || null

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
    log.error({ err }, 'Portal OTP SMS gönderilemedi')
    // SMS gönderilemese bile devam et (geliştirme ortamında)
  }

  return NextResponse.json({ success: true, message: `${normalizedPhone} numarasına doğrulama kodu gönderildi` })
}
