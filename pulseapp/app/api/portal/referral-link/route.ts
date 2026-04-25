import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { requirePortalSession } from '@/lib/portal/guards'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/referral-link' })

/**
 * 8 karakterlik alfanumerik kısa kod üretir.
 * Karışıklığı önlemek için 0/O/I/1 gibi karakterler hariç tutuldu.
 */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function generateReferralCode(): string {
  const bytes = crypto.randomBytes(8)
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length]
  }
  return code
}

/**
 * GET /api/portal/referral-link
 *
 * Müşteriye benzersiz tavsiye linki döndürür. İlk çağrıda customers.referral_code üretir,
 * sonraki çağrılarda mevcut kodu döner. Çakışma riskine karşı 5 deneme.
 *
 * Response: { code, url, stats: { totalReferrals, converted } }
 */
export async function GET(request: NextRequest) {
  const guard = requirePortalSession(request)
  if (guard instanceof NextResponse) return guard
  const { customerId, businessId } = guard

  const admin = createAdminClient()

  // Mevcut kodu çek
  const { data: customer } = await admin
    .from('customers')
    .select('referral_code')
    .eq('id', customerId)
    .eq('business_id', businessId)
    .single()

  let code = (customer as { referral_code?: string | null } | null)?.referral_code ?? null

  if (!code) {
    // 5 deneme — UNIQUE constraint çakışırsa retry
    for (let attempt = 0; attempt < 5 && !code; attempt++) {
      const candidate = generateReferralCode()
      const { error } = await admin
        .from('customers')
        .update({ referral_code: candidate })
        .eq('id', customerId)
        .eq('business_id', businessId)
        .is('referral_code', null) // race protection: başka concurrent çağrı yazmadan al

      if (!error) {
        code = candidate
        break
      }
      // Eğer hata `referral_code` UNIQUE çakışması ise tekrar dene; başka error ise loop sürdürmeyelim
      if (error.code !== '23505') {
        log.error({ err: error, attempt }, 'Tavsiye kodu yazılamadı')
        break
      }
    }
    // Eğer hâlâ yoksa, başka bir concurrent çağrı yazdıysa tekrar oku
    if (!code) {
      const { data: refetched } = await admin
        .from('customers')
        .select('referral_code')
        .eq('id', customerId)
        .eq('business_id', businessId)
        .single()
      code = refetched?.referral_code ?? null
    }
  }

  if (!code) {
    return NextResponse.json({ error: 'Tavsiye kodu üretilemedi' }, { status: 500 })
  }

  // İstatistikler
  const [{ count: totalCount }, { count: convertedCount }] = await Promise.all([
    admin
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('referrer_customer_id', customerId),
    admin
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('referrer_customer_id', customerId)
      .eq('status', 'rewarded'),
  ])

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
  const url = `${appUrl}/r/${code}`

  return NextResponse.json({
    code,
    url,
    stats: {
      totalReferrals: totalCount ?? 0,
      converted: convertedCount ?? 0,
    },
  })
}
