// Pilot modu yardımcıları.
// Pilot modu: işletme settings.pilot_mode = true iken ücretli aboneliklere bağımlı
// özellikler (PayTR, Paraşüt, Twilio SMS/WA, otomatik cron) gizlenir; SMS/WA
// gönderimleri uygulama-içi bildirim olarak personele iletilir.

import type { BusinessSettings } from '@/types'

export type PilotDisabledFeature =
  | 'paytr_billing'
  | 'parasut_efatura'
  | 'plan_upgrade'
  | 'sms_send'
  | 'whatsapp_send'
  | 'auto_cron'
  | 'campaigns'

/** Pilot modunda gizlenmesi/devre dışı bırakılması gereken özellikler. */
export const PILOT_DISABLED_FEATURES: readonly PilotDisabledFeature[] = [
  'paytr_billing',
  'parasut_efatura',
  'plan_upgrade',
  'sms_send',
  'whatsapp_send',
  'auto_cron',
  'campaigns',
] as const

/** Settings nesnesinden pilot modu durumunu okur. */
export function isPilotMode(settings: Pick<BusinessSettings, 'pilot_mode'> | null | undefined): boolean {
  return settings?.pilot_mode === true
}

/** Pilot modu için kullanıcıya gösterilecek standart kısa açıklama. */
export const PILOT_BANNER_MESSAGE =
  'Pilot modu aktif — ödeme, e-fatura, otomatik SMS ve WhatsApp gönderimleri devre dışı. ' +
  'Pilot süresince mesajlar bildirim olarak personele iletilir.'

/** Bir özelliğin pilot modunda devre dışı olup olmadığını döner. */
export function isPilotFeatureDisabled(
  settings: Pick<BusinessSettings, 'pilot_mode'> | null | undefined,
  feature: PilotDisabledFeature
): boolean {
  return isPilotMode(settings) && PILOT_DISABLED_FEATURES.includes(feature)
}
