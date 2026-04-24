/**
 * Webhook'tan gelen telefon numarasına göre müşteri/işletme bulma — SMS + WhatsApp
 * webhook'larında ortak.
 *
 * T1.4 — Orphan deterministik: aynı telefon 2+ işletmede aktif olarak kayıtlı ise
 * spoofing riski var (saldırgan rastgele birini hedef alabilir). 2+ match'te
 * `null` döndürüp staff'a alert düşürürüz.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { normalizePhone, phoneOrFilter } from '@/lib/utils/phone'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ module: 'webhooks/resolve-customer' })

export interface InboundCustomer {
  id: string
  business_id: string
  name: string
}

export async function resolveInboundCustomer(
  admin: SupabaseClient,
  from: string,
): Promise<InboundCustomer | null> {
  const normalized = normalizePhone(from)
  if (!normalized) return null

  const { data } = await admin
    .from('customers')
    .select('id, business_id, name')
    .or(phoneOrFilter(normalized))
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(2)

  if (!data || data.length === 0) return null

  if (data.length > 1) {
    // Aynı numara birden fazla işletmede kayıtlı — deterministik seçim yok, spoofing riski.
    // Mesajı düşür ve her eşleşen işletmeye ai_alert düşür.
    log.warn(
      { from, normalized, matches: data.length },
      'Inbound numara birden fazla işletmede eşleşti — mesaj düşürüldü (spoofing koruması)',
    )
    const alerts = data.map((c: { id: string; business_id: string; name: string }) => ({
      business_id: c.business_id,
      type: 'ai_alert' as const,
      title: 'Numara çakışması: manuel doğrulama gerekli',
      body: `${from} numarası birden fazla işletmede aktif müşteri olarak kayıtlı. Otomatik mesaj işlenmedi; ilgili müşteriyi manuel doğrulayın.`,
      related_id: c.id,
      related_type: 'customer',
    }))
    await admin.from('notifications').insert(alerts)
    return null
  }

  return data[0]
}
