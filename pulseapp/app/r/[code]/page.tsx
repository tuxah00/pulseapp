import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Kampanya SMS'indeki kısa link handler: /r/<short_code>
 *
 * short_code 8-karakterli bir recipient identifier'ı.
 * Bu route onu çözer, business_id'yi bulur ve booking sayfasına
 * ?c=<recipient_uuid> ile forward eder — attribution akışı aynı kalır.
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
  const { data: recipient } = await admin
    .from('campaign_recipients')
    .select('id, campaigns!inner(business_id)')
    .eq('short_code', code)
    .maybeSingle()

  if (!recipient) {
    redirect('/')
  }

  // Supabase nested select: campaigns tek obje veya tek-elemanlı dizi olabilir
  const campaigns = recipient.campaigns as unknown
  const businessId = Array.isArray(campaigns)
    ? (campaigns as Array<{ business_id: string }>)[0]?.business_id
    : (campaigns as { business_id: string } | null | undefined)?.business_id

  if (!businessId) {
    redirect('/')
  }

  redirect(`/book/${businessId}?c=${recipient.id}`)
}
