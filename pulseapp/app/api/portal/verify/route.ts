import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { isValidUUID } from '@/lib/utils/validate'
import { setPortalSessionCookies } from '@/lib/portal/auth'
import crypto from 'crypto'

// POST — OTP doğrula ve müşteri cookie'si oluştur
export async function POST(request: NextRequest) {
  // Brute-force koruması — 5 dakikada maks 10 deneme
  const rl = checkRateLimit(request, RATE_LIMITS.auth)
  if (rl.limited) return rl.response

  const body = await request.json()
  const { businessId, phone, otp } = body

  if (!businessId || !phone || !otp || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'businessId, telefon ve kod zorunludur' }, { status: 400 })
  }

  // OTP format kontrolü — 6 haneli sayısal
  const otpStr = String(otp)
  if (!/^\d{6}$/.test(otpStr)) {
    return NextResponse.json({ error: 'Geçersiz kod formatı' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)

  const admin = createAdminClient()
  const now = new Date().toISOString()

  // OTP'yi doğrula
  const { data: otpRecord } = await admin
    .from('portal_otps')
    .select('id, otp, expires_at, used')
    .eq('business_id', businessId)
    .eq('phone', normalizedPhone)
    .eq('used', false)
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!otpRecord) {
    return NextResponse.json({ error: 'Geçersiz veya süresi dolmuş kod' }, { status: 401 })
  }

  // Timing-safe karşılaştırma — her iki taraf da /^\d{6}$/ gate'inden geçti, uzunluk garantili
  const match =
    otpRecord.otp.length === 6 &&
    crypto.timingSafeEqual(Buffer.from(otpRecord.otp), Buffer.from(otpStr))

  if (!match) {
    // Yanlış OTP: kayıt tek kullanımlık olduğundan brute-force engellemek için yakılır
    await admin.from('portal_otps').update({ used: true }).eq('id', otpRecord.id)
    return NextResponse.json({ error: 'Hatalı doğrulama kodu' }, { status: 401 })
  }

  // OTP'yi kullanıldı olarak işaretle
  await admin
    .from('portal_otps')
    .update({ used: true })
    .eq('id', otpRecord.id)

  // Müşteriyi bul (tüm telefon formatları)
  const { data: verifiedCustomers } = await admin
    .from('customers')
    .select('id, name, phone, segment, birthday')
    .eq('business_id', businessId)
    .or(phoneOrFilter(normalizedPhone))
    .eq('is_active', true)
    .limit(1)

  const customer = verifiedCustomers?.[0] || null

  if (!customer) {
    return NextResponse.json({ error: 'Müşteri bulunamadı' }, { status: 404 })
  }

  const response = NextResponse.json({
    success: true,
    customer: {
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      segment: customer.segment,
    },
  })

  return setPortalSessionCookies(response, { customerId: customer.id, businessId })
}
