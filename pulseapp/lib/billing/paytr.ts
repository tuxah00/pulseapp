/**
 * PayTR iFrame API entegrasyonu
 *
 * Aktif etmek için gerekli env değişkenleri:
 *   PAYTR_MERCHANT_ID
 *   PAYTR_MERCHANT_KEY
 *   PAYTR_MERCHANT_SALT
 *
 * https://dev.paytr.com/iframe-api
 */
import crypto from 'crypto'

const PAYTR_API_URL = 'https://www.paytr.com/odeme/api/v1'

export interface PaytrTokenParams {
  merchantOid: string        // Benzersiz sipariş ID (örn: SUB-businessId-timestamp)
  email: string
  paymentAmountKurus: number // 100 = 1 TRY
  userName: string
  userAddress: string
  userPhone: string
  userIp: string
  currency?: string          // Default: 'TL'
  testMode?: boolean
  installmentCount?: number  // 0 = peşin
}

export interface PaytrTokenResult {
  token: string
  iframeUrl: string
}

export async function createPaytrToken(params: PaytrTokenParams): Promise<PaytrTokenResult> {
  const merchantId = process.env.PAYTR_MERCHANT_ID!
  const merchantKey = process.env.PAYTR_MERCHANT_KEY!
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT!

  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error('PayTR env değişkenleri eksik: PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const testMode = params.testMode ?? process.env.NODE_ENV !== 'production' ? 1 : 0
  const currency = params.currency || 'TL'
  const installmentCount = params.installmentCount || 0

  // Basit basket: abonelik kalemi
  const basket = JSON.stringify([['PulseApp Abonelik', String(params.paymentAmountKurus / 100), 1]])
  const basketEncoded = Buffer.from(basket).toString('base64')

  // Hash oluştur: HMAC-SHA256
  const hashStr = `${merchantId}${params.userIp}${params.merchantOid}${params.email}${params.paymentAmountKurus}card${installmentCount}${currency}${testMode}0`
  const paytrToken = crypto
    .createHmac('sha256', merchantKey + merchantSalt)
    .update(hashStr)
    .digest('base64')

  const formData = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: String(params.paymentAmountKurus),
    paytr_token: paytrToken,
    user_basket: basketEncoded,
    debug_on: testMode ? '1' : '0',
    no_installment: installmentCount === 0 ? '1' : '0',
    max_installment: installmentCount === 0 ? '0' : String(installmentCount),
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: `${appUrl}/dashboard/settings/billing?payment=success`,
    merchant_fail_url: `${appUrl}/dashboard/settings/billing?payment=failed`,
    timeout_limit: '30',
    currency,
    test_mode: String(testMode),
    non_3d: '0',
  })

  const response = await fetch(PAYTR_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  })

  const result = await response.json() as { status: string; token?: string; reason?: string }

  if (result.status !== 'success' || !result.token) {
    throw new Error(`PayTR token hatası: ${result.reason || 'Bilinmeyen hata'}`)
  }

  return {
    token: result.token,
    iframeUrl: `https://www.paytr.com/odeme/guvenli/${result.token}`,
  }
}

export interface PaytrCallbackData {
  merchant_oid: string
  status: 'success' | 'failed'
  total_amount: string
  hash: string
  failed_reason_code?: string
  failed_reason_msg?: string
  test_mode: string
  payment_type: string
  currency: string
  payment_amount: string
}

/**
 * PayTR webhook callback imzasını doğrula.
 * Returns true if hash is valid.
 */
export function verifyPaytrCallback(data: PaytrCallbackData): boolean {
  const merchantKey = process.env.PAYTR_MERCHANT_KEY!
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT!

  if (!merchantKey || !merchantSalt) return false

  const hashStr = `${data.merchant_oid}${merchantSalt}${data.status}${data.total_amount}`
  const expectedHash = crypto
    .createHmac('sha256', merchantKey + merchantSalt)
    .update(hashStr)
    .digest('base64')

  return expectedHash === data.hash
}

/**
 * merchant_oid'den businessId'yi parse et.
 * Format: SUB-{businessId}-{timestamp}
 */
export function parseOrderId(merchantOid: string): { businessId: string; planType: string } | null {
  const parts = merchantOid.split('-')
  // Format: SUB-{planType}-{businessId}-{timestamp}
  if (parts.length >= 4 && parts[0] === 'SUB') {
    return { planType: parts[1], businessId: parts[2] }
  }
  return null
}

/**
 * Plan adından aylık fiyatı döndür (Türk Lirası kuruş cinsinden)
 */
export function getPlanPriceKurus(plan: string): number {
  const prices: Record<string, number> = {
    starter: 49900,   // 499 TL
    standard: 99900,  // 999 TL
    pro: 199900,      // 1999 TL
  }
  return prices[plan] ?? 49900
}
