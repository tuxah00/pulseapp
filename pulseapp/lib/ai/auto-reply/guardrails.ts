/**
 * Otomatik yanıt güvenlik katmanı (Faz 1)
 *
 * Spam, kötüye kullanım ve maliyet kaçışını önler:
 * - Saat aralığı dışında yanıt vermez
 * - Aynı müşteriye 5 dk cooldown
 * - Günlük işletme bazlı cap
 * - Mod kapalıysa hiç çalışmaz
 *
 * T1.5 — Cooldown + cap kontrolleri Postgres advisory lock altında tek RPC çağrısı
 * ile atomik çalışır. Eş zamanlı webhook'lar (SMS + WA) cap'i atlayamaz.
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
 * Ucuz local kontroller önce (mod, saat); DB kontrolleri tek RPC'de atomik.
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

  const dailyCap = settings.auto_reply_daily_cap ?? AUTO_REPLY_DEFAULTS.dailyCap
  const perCustomerCap = settings.auto_reply_per_customer_cap ?? AUTO_REPLY_DEFAULTS.perCustomerDailyCap
  const cooldownMinutes = settings.auto_reply_cooldown_minutes ?? AUTO_REPLY_DEFAULTS.cooldownMinutes

  const { data, error } = await admin.rpc('check_auto_reply_allowed', {
    p_business_id: businessId,
    p_customer_id: customerId,
    p_cooldown_minutes: cooldownMinutes,
    p_per_customer_cap: perCustomerCap,
    p_business_cap: dailyCap,
  })

  if (error) {
    // RPC hatasında fail-closed: yanıt gönderme (güvenlik > kullanılabilirlik)
    return { allowed: false, reason: `rpc_error:${error.message}` }
  }

  const decision = (data as string | null) ?? 'rpc_null'
  if (decision === 'ok') return { allowed: true }
  return { allowed: false, reason: decision }
}

/**
 * HH:mm aralık kontrolü. end > start varsayımı (geceyi kapsamaz).
 */
function isWithinHours(nowHHMM: string, start: string, end: string): boolean {
  return nowHHMM >= start && nowHHMM < end
}
