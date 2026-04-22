import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { phoneOrFilter } from '@/lib/utils/phone'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { validateBody } from '@/lib/api/validate'
import { portalPhoneLookupSchema } from '@/lib/schemas'
import { setPortalSessionCookies } from '@/lib/portal/auth'

// POST — OTP atlamadan doğrudan müşteri girişi (SMS servisi aktif olana kadar)
export async function POST(request: NextRequest) {
  // Enumerasyon saldırısına karşı katı rate limit
  const rl = checkRateLimit(request, RATE_LIMITS.auth)
  if (rl.limited) return rl.response

  const parsed = await validateBody(request, portalPhoneLookupSchema)
  if (!parsed.ok) return parsed.response
  // phoneField schema zaten normalize eder
  const { businessId, phone: normalizedPhone } = parsed.data

  const admin = createAdminClient()

  // İşletme ve müşteri sorgularını paralel çalıştır
  const [bizResult, customerResult] = await Promise.all([
    admin.from('businesses').select('id, is_active').eq('id', businessId).single(),
    admin.from('customers').select('id, name, phone, segment, birthday')
      .eq('business_id', businessId)
      .or(phoneOrFilter(normalizedPhone))
      .eq('is_active', true)
      .limit(1),
  ])

  // Enumerasyon koruması: tek tip hata mesajı — işletme mi yoksa müşteri mi yok ayrımı yapılmaz
  if (!bizResult.data || bizResult.data.is_active === false) {
    return NextResponse.json({ error: 'Giriş başarısız' }, { status: 404 })
  }

  const customer = customerResult.data?.[0] || null

  if (!customer) {
    return NextResponse.json({ error: 'Giriş başarısız' }, { status: 404 })
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
