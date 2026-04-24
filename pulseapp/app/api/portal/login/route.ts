import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'
import { checkRateLimit, RATE_LIMITS } from '@/lib/api/rate-limit'
import { isValidUUID } from '@/lib/utils/validate'
import { setPortalSessionCookies } from '@/lib/portal/auth'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ route: 'api/portal/login' })

// POST — Pilot modunda kullanılan giriş: telefon + doğum tarihi.
// SMS yok, direct-login'den bir kat daha güvenli (spoofing'e karşı doğum tarihi şartı).
export async function POST(request: NextRequest) {
  // Enumerasyon ve brute-force koruması
  const rl = checkRateLimit(request, RATE_LIMITS.auth)
  if (rl.limited) return rl.response

  let body: { businessId?: string; phone?: string; birthDate?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Geçersiz istek' }, { status: 400 })
  }

  const { businessId, phone, birthDate } = body
  if (!businessId || !phone || !birthDate || !isValidUUID(businessId)) {
    return NextResponse.json({ error: 'Bilgiler eksik' }, { status: 400 })
  }

  // birthDate ISO YYYY-MM-DD bekleniyor (input[type=date])
  if (!/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
    return NextResponse.json({ error: 'Geçersiz doğum tarihi' }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  const admin = createAdminClient()

  const [bizResult, customerResult] = await Promise.all([
    admin.from('businesses').select('id, is_active').eq('id', businessId).single(),
    admin.from('customers')
      .select('id, name, phone, segment, birthday')
      .eq('business_id', businessId)
      .or(phoneOrFilter(normalizedPhone))
      .eq('is_active', true)
      .limit(1),
  ])

  if (!bizResult.data || bizResult.data.is_active === false) {
    return NextResponse.json({ error: 'Bilgiler eşleşmedi' }, { status: 404 })
  }

  const customer = customerResult.data?.[0] || null

  // Tek tip hata mesajı (enumeration koruması)
  if (!customer) {
    return NextResponse.json({ error: 'Bilgiler eşleşmedi' }, { status: 404 })
  }

  if (!customer.birthday) {
    log.warn({ businessId, customerId: customer.id }, 'Portal giriş — müşterinin doğum tarihi DB\'de eksik')
    return NextResponse.json({
      error: 'Hesabınız doğum tarihinizle eşleşmek için işletmeden bilgi tamamlanmasını bekliyor.',
    }, { status: 409 })
  }

  // Doğum tarihi normalize karşılaştırma — DB'deki birthday TIMESTAMP veya DATE olabilir
  const dbBirthday = new Date(customer.birthday).toISOString().slice(0, 10)
  if (dbBirthday !== birthDate) {
    return NextResponse.json({ error: 'Bilgiler eşleşmedi' }, { status: 404 })
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
