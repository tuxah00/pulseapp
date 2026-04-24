/**
 * Otomatik yanıt güvenlik katmanı (Faz 1)
 *
 * Spam, kötüye kullanım ve maliyet kaçışını önler:
 * - Saat aralığı dışında yanıt vermez
 * - Aynı müşteriye 5 dk cooldown
 * - Günlük işletme bazlı cap
 * - Mod kapalıysa hiç çalışmaz
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { BusinessSettings } from '@/types'
import { AUTO_REPLY_DEFAULTS } from './defaults'

export interface GuardrailDecision {
  allowed: boolean
  /** İzin reddedildiyse sebep (log için) */
  reason?: string
}

export interface GuardrailParams {
  admin: SupabaseClient
  businessId: string
  customerId: string
  settings: BusinessSettings | null | undefined
  /** Kontrol anının ISO string'i (test için override edilebilir) */
  now?: Date
}

/**
 * Tüm otomatik yanıt öncesi kontrolleri tek seferde yapar.
 * Webhook'ta tek çağrı ile cevap: yanıt göndereyim mi?
 *
 * Ucuz local kontroller önce (mod, saat); DB kontrolleri tek turda paralel.
 */
export async function checkGuardrails(params: GuardrailParams): Promise<GuardrailDecision> {
  const { admin, businessId, customerId, settings, now = new Date() } = params

  if (!settings?.ai_auto_reply) {
    return { allowed: false, reason: 'ai_auto_reply_disabled' }
  }
  const mode = settings.auto_reply_mode ?? AUTO_REPLY_DEFAULTS.mode
  if (mode === 'off') {
    return { allowed: false, reason: 'auto_reply_mode_off' }
  }

  // Saat aralığı: server saati (Türkiye için tek TZ varsayımı)
  const hours = settings.auto_reply_hours ?? AUTO_REPLY_DEFAULTS.hours
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  if (!isWithinHours(hhmm, hours.start, hours.end)) {
    return { allowed: false, reason: 'outside_hours' }
  }

  // DB kontrolleri — cooldown + iki cap aynı anda sorgulanır (latency tasarrufu)
  const cooldownSince = new Date(now.getTime() - AUTO_REPLY_DEFAULTS.cooldownMinutes * 60_000).toISOString()
  const windowStart = new Date(now.getTime() - 24 * 60 * 60_000).toISOString()
  const dailyCap = settings.auto_reply_daily_cap ?? AUTO_REPLY_DEFAULTS.dailyCap

  const countQuery = () => admin
    .from('messages')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
    .eq('direction', 'outbound')
    .eq('message_type', 'ai_auto_reply')
    .gte('created_at', windowStart)

  const [cooldown, customer, business] = await Promise.all([
    admin
      .from('messages')
      .select('id')
      .eq('business_id', businessId)
      .eq('customer_id', customerId)
      .eq('direction', 'outbound')
      .eq('message_type', 'ai_auto_reply')
      .gte('created_at', cooldownSince)
      .limit(1),
    countQuery().eq('customer_id', customerId),
    countQuery(),
  ])

  if ((cooldown.data?.length ?? 0) > 0) {
    return { allowed: false, reason: 'cooldown' }
  }
  if ((customer.count ?? 0) >= AUTO_REPLY_DEFAULTS.perCustomerDailyCap) {
    return { allowed: false, reason: 'per_customer_cap' }
  }
  if ((business.count ?? 0) >= dailyCap) {
    return { allowed: false, reason: 'business_daily_cap' }
  }

  return { allowed: true }
}

/**
 * HH:mm aralık kontrolü. end > start varsayımı (geceyi kapsamaz).
 */
function isWithinHours(nowHHMM: string, start: string, end: string): boolean {
  return nowHHMM >= start && nowHHMM < end
}
