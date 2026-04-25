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
 * Müşteri portal'dan fatura ödemesi için merchant_oid (`INV-{invoiceId}-{ts}`)
 * üreten ve PayTR token oluşturan helper. Subscription token'dan farkı:
 *  - basket: "Fatura ödemesi"
 *  - merchant_ok_url / merchant_fail_url portal'a yönlendirir
 *  - testMode default değişmedi (env'e bağlı)
 */
export interface PaytrInvoiceTokenParams {
  invoiceId: string
  businessId: string
  email: string
  paymentAmountKurus: number
  userName: string
  userAddress: string
  userPhone: string
  userIp: string
}

export async function createInvoicePaytrToken(
  params: PaytrInvoiceTokenParams
): Promise<PaytrTokenResult & { merchantOid: string }> {
  const merchantId = process.env.PAYTR_MERCHANT_ID!
  const merchantKey = process.env.PAYTR_MERCHANT_KEY!
  const merchantSalt = process.env.PAYTR_MERCHANT_SALT!

  if (!merchantId || !merchantKey || !merchantSalt) {
    throw new Error('PayTR env değişkenleri eksik: PAYTR_MERCHANT_ID, PAYTR_MERCHANT_KEY, PAYTR_MERCHANT_SALT')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const testMode = process.env.NODE_ENV !== 'production' ? 1 : 0
  const currency = 'TL'
  const installmentCount = 0
  // Format: INV{32hexInvoiceId}{ts13} = 48 char (PayTR limit 64).
  // Tam UUID hex'ini saklarız → webhook geri parse edip invoice_id'yi tekrar oluşturabilir.
  const fullHex = params.invoiceId.replace(/-/g, '')
  const merchantOid = `INV${fullHex}${Date.now()}`

  const basket = JSON.stringify([['Fatura ödemesi', String(params.paymentAmountKurus / 100), 1]])
  const basketEncoded = Buffer.from(basket).toString('base64')

  const hashStr = `${merchantId}${params.userIp}${merchantOid}${params.email}${params.paymentAmountKurus}card${installmentCount}${currency}${testMode}0`
  const paytrToken = crypto
    .createHmac('sha256', merchantKey + merchantSalt)
    .update(hashStr)
    .digest('base64')

  const formData = new URLSearchParams({
    merchant_id: merchantId,
    user_ip: params.userIp,
    merchant_oid: merchantOid,
    email: params.email,
    payment_amount: String(params.paymentAmountKurus),
    paytr_token: paytrToken,
    user_basket: basketEncoded,
    debug_on: testMode ? '1' : '0',
    no_installment: '1',
    max_installment: '0',
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: `${appUrl}/portal/${params.businessId}/dashboard/invoices/${params.invoiceId}?payment=success`,
    merchant_fail_url: `${appUrl}/portal/${params.businessId}/dashboard/invoices/${params.invoiceId}?payment=failed`,
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

  const result = (await response.json()) as { status: string; token?: string; reason?: string }

  if (result.status !== 'success' || !result.token) {
    throw new Error(`PayTR token hatası: ${result.reason || 'Bilinmeyen hata'}`)
  }

  return {
    token: result.token,
    iframeUrl: `https://www.paytr.com/odeme/guvenli/${result.token}`,
    merchantOid,
  }
}

/**
 * Invoice merchant_oid parse helper.
 * Format: INV{32hex}{ts}
 * Returns invoice_id with hyphens restored (8-4-4-4-12 UUID format).
 */
export function parseInvoiceMerchantOid(merchantOid: string): { invoiceId: string } | null {
  if (!merchantOid.startsWith('INV')) return null
  const hex = merchantOid.slice(3, 35)
  if (hex.length !== 32 || !/^[0-9a-f]{32}$/i.test(hex)) return null
  // 8-4-4-4-12
  const invoiceId = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
  return { invoiceId }
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
