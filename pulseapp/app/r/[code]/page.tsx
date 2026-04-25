import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Kısa link handler: /r/<code>
 *
 * Kod iki kaynağa karşı çözülür:
 *  1) `campaign_recipients.short_code` — kampanya SMS'leri için (mevcut akış)
 *  2) `customers.referral_code` — müşteri tavsiye linkleri (Faz 4B)
 *
 * Önce kampanya recipient'ı denenir; bulunmazsa müşteri tavsiyesi denenir.
 * Customer kodu eşleşince `/book/<businessId>?ref=<customerId>` yönlendirmesi yapılır
 * (booking handler tarafı `?ref` query param'ı ile referrer_customer_id'yi referrals
 * tablosuna düşürür — booking handler ileride güncellenecek; şimdilik link sonuçlanır).
 *
 * Public endpoint; auth yok. RLS bypass için admin client kullanılır
 * çünkü müşteri giriş yapmamış oluyor. Kod geçersizse anasayfaya atar.
 */
export default async function ShortCodeRedirect({
  params,
}: {
  params: { code: string }
}) {
  const code = params.code?.trim()

  // Temel format kontrolü — alfanumerik, 6–12 karakter arası
  if (!code || !/^[A-Za-z0-9]{6,12}$/.test(code)) {
    redirect('/')
  }

  const admin = createAdminClient()

  // 1) Kampanya recipient kodu mu?
  const { data: recipient } = await admin
    .from('campaign_recipients')
    .select('id, campaigns!inner(business_id)')
    .eq('short_code', code)
    .maybeSingle()

  if (recipient) {
    // Supabase nested select: campaigns tek obje veya tek-elemanlı dizi olabilir
    const campaigns = recipient.campaigns as unknown
    const businessId = Array.isArray(campaigns)
      ? (campaigns as Array<{ business_id: string }>)[0]?.business_id
      : (campaigns as { business_id: string } | null | undefined)?.business_id

    if (businessId) {
      redirect(`/book/${businessId}?c=${recipient.id}`)
    }
  }

  // 2) Müşteri tavsiye kodu mu?
  const { data: referrer } = await admin
    .from('customers')
    .select('id, business_id, is_active')
    .eq('referral_code', code)
    .maybeSingle()

  if (referrer && referrer.is_active) {
    redirect(`/book/${referrer.business_id}?ref=${referrer.id}`)
  }

  redirect('/')
}
