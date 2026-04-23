// ================================================
// lib/insights/types.ts
// İş Zekası öneri motoru — ortak tipler
// ================================================
// Bu modül, panel bölümlerinin veri → öneri → aksiyon üçlüsünü standartlaştırır.
// Her InsightSection bileşeni (Gelir, Gider, Hizmet, Kampanya, Doluluk,
// Müşteri Mix) aynı kontrata bağlı kalır.

export type InsightSeverity = 'info' | 'normal' | 'high' | 'critical'

export type InsightCategory =
  | 'revenue'
  | 'expense'
  | 'service'
  | 'campaign'
  | 'message'
  | 'occupancy'
  | 'no_show'
  | 'segment'
  | 'waitlist'

/**
 * Panel bölümünün yan kolonunda gösterilen metin + aksiyon paketi.
 * API endpoint'leri dataset ile birlikte döner, UI hiçbir hesaplama
 * yapmadan ekrana basar.
 */
export interface InsightBlock {
  template_key: string
  category: InsightCategory
  severity: InsightSeverity
  title: string
  message: string
  /** Opsiyonel destekleyici metrikler (örn: "%58", "4.2×", "3 randevu") */
  highlights?: string[]
  /** "Asistan aksiyonu oluştur" butonları — boş olabilir */
  actions: InsightAction[]
  /** AI rafinman için kaynak veri — özet + yüzdeler, PII yok */
  refineContext?: Record<string, string | number | boolean>
}

/**
 * Tek tıkla ai_pending_actions kuyruğuna eklenebilecek öneri.
 * `action_type` ve `payload` değerleri POST /api/insights/apply ile eşleşir.
 */
export interface InsightAction {
  key: string
  label: string
  action_type: InsightActionType
  /** Endpoint'e aynen iletilir; kullanıcı metin editleyebilir. */
  payload: Record<string, unknown>
  /** Birincil aksiyon mu? UI primary/ghost stilini buna göre seçer. */
  primary?: boolean
}

export type InsightActionType =
  | 'create_campaign'
  | 'create_package'
  | 'create_message_flow'
  | 'adjust_working_hours'
  | 'adjust_service_price'
  | 'schedule_reminder'
  | 'open_segment_filter'
  | 'send_winback'
  | 'send_birthday_review'
  | 'enable_confirmation_sms'
  | 'budget_alert'
  | 'custom_note'

/**
 * Veri paterni → şablon eşlemesi. `generate()` bu şablonların match'ini
 * sırayla dener, ilk eşleşeni döndürür (veya hiçbiri uymazsa "tüm iyi"
 * varyantı).
 */
export interface InsightTemplate<TInput = unknown> {
  key: string
  category: InsightCategory
  /**
   * Veriye uygun mu? False ise generator atlanır.
   * Match sırası önemli: daha spesifik şablonlar önce gelmeli.
   */
  match: (input: TInput) => boolean
  /** Eşleşen şablonun final metnini + aksiyonları üretir. */
  generate: (input: TInput) => Omit<InsightBlock, 'template_key' | 'category'>
}
