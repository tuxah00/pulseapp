/**
 * PulseApp Kazandırdıkları panelindeki her metrik için hesaplama yöntemi açıklamaları.
 * (?) ikonuna tıklanınca popup'ta gösterilir.
 *
 * Dürüstlük ilkesi: her açıklama sadece kaynak veriyi ve varsayımları belirtir —
 * abartılı iddia yoktur.
 */

/**
 * Tahmini iş süresi & attribution sabitleri.
 * API ve UI bu tek kaynaktan okur; değiştirilince her iki taraf senkron kalır.
 * İleride business.settings altına taşınabilir.
 */
export const PULSE_VALUE_ASSUMPTIONS = {
  minutes_per_reminder: 2,        // SMS/WA hatırlatma başına
  minutes_per_confirmation: 3,    // Telefonla onay araması başına
  minutes_per_ai_action: 5,       // AI asistanın yerine geçtiği manuel eylem
  minutes_per_message: 1,         // Sistem mesajı (onay, teşekkür vb.)
  minutes_per_followup: 3,        // Takip araması/mesajı
  hourly_rate_try: 30,            // Saatlik iş maliyeti (₺)
  attribution_window_days: 30,    // Kampanya alıcı → randevu attribution penceresi
} as const

export type PulseValueAssumptions = typeof PULSE_VALUE_ASSUMPTIONS

/**
 * API yanıt şekli — hem route.ts hem panel.tsx bu tipi kullanır.
 */
export interface PulseValueData {
  period: { from: string; to: string }
  assumptions: PulseValueAssumptions
  summary: {
    saved_minutes: number
    saved_money_estimate: number
    digital_revenue: number
    new_returning_customers: number
  }
  automation: {
    reminders_24h: { count: number; est_minutes: number }
    reminders_2h: { count: number; est_minutes: number }
    self_confirmations: { count: number; est_minutes: number }
    ai_actions: { count: number; est_minutes: number }
    system_messages: { count: number; est_minutes: number }
    follow_ups: { count: number; est_minutes: number }
  }
  digital_revenue: {
    web_appointments: { count: number; revenue: number }
    ai_appointments: { count: number; revenue: number }
    gap_fill: { count: number; revenue: number }
    campaign_sourced: { count: number; revenue: number }
  }
  growth: {
    referrals_converted: { count: number; revenue: number }
    winback_recovered: { count: number }
    rewards_used: { count: number }
    birthday_driven: { count: number }
  }
  experience: {
    review_requests: { count: number }
    reviews_received: { count: number; avg_rating: number }
    pos_transactions: { count: number; total: number }
    periodic_reminders: { count: number }
    workflow_runs: { count: number }
  }
}

export interface ValueMethodDescription {
  title: string
  summary: string
  steps: string[]
  assumption?: string
}

export const VALUE_METHOD_DESCRIPTIONS: Record<string, ValueMethodDescription> = {
  // ═══ Özet kartları ═══
  saved_time: {
    title: 'Kazandırılan Zaman',
    summary: 'Otomasyonun sizin yerinize yaptığı işler için tahmini süre.',
    steps: [
      'Gönderilen hatırlatmalar × ~2 dk',
      'Müşteri self-onayları × ~3 dk',
      'AI asistanın yürüttüğü eylemler × ~5 dk',
      'Otomatik sistem mesajları × ~1 dk',
      'Takip kuyruğu gönderimleri × ~3 dk',
    ],
    assumption: 'Manuel yapılsa her biri için işletme sahibi/personelin harcayacağı ortalama süre.',
  },
  saved_money: {
    title: 'Zaman → Para',
    summary: 'Kazanılan süre ₺ cinsine çevrilir.',
    steps: [
      'Toplam kazanılan dakika / 60 = saat',
      'Saat × 30 ₺/saat = zaman maliyeti (₺)',
    ],
    assumption: 'Standart iş zamanı maliyeti 30 ₺/saat. Sektöre göre farklılık gösterebilir.',
  },
  digital_revenue: {
    title: 'Dijital Kanal Geliri',
    summary: 'Platform olmasa oluşmayacak veya çok zor oluşacak randevu gelirlerinin toplamı.',
    steps: [
      'Online link üzerinden gelen randevu geliri',
      'AI asistanın oluşturduğu randevu geliri',
      'Gap-fill (boş slot doldurma) bildirimi sonrası gelen gelir',
      'Kampanya alıcısının 30 gün içinde aldığı randevu geliri (attribution)',
    ],
    assumption: 'Manuel telefon akışı bu kanallara alternatif değildir.',
  },
  new_returning: {
    title: 'Yeni / Geri Dönen Müşteri',
    summary: 'PulseApp özelliklerinin getirdiği müşteri sayısı.',
    steps: [
      'Referans sistemi üzerinden dönüşen müşteriler',
      'Winback kampanyası ile geri kazanılan müşteriler',
    ],
    assumption: 'Bu müşteriler platformun ilgili özellikleri olmadan büyük ihtimalle gelmezdi.',
  },

  // ═══ Grup 1: Otomasyon Kazanımları ═══
  reminders_24h: {
    title: '24 Saat Öncesi Hatırlatma',
    summary: 'Randevudan 24 saat önce otomatik gönderilen SMS/WhatsApp hatırlatmaları.',
    steps: [
      'appointments.reminder_24h_sent = true olan randevular sayılır',
      'Her hatırlatma manuel yapılsaydı ~2 dk sürerdi (numara bul, mesaj yaz, gönder, teyit et)',
    ],
    assumption: 'Hatırlatma başına 2 dakika',
  },
  reminders_2h: {
    title: '2 Saat Öncesi Hatırlatma',
    summary: 'Randevudan 2 saat önce otomatik gönderilen son dakika hatırlatmaları.',
    steps: [
      'appointments.reminder_2h_sent = true olan randevular sayılır',
      'Her hatırlatma manuel yapılsaydı ~2 dk sürerdi',
    ],
    assumption: 'Hatırlatma başına 2 dakika',
  },
  self_confirmations: {
    title: 'Müşteri Self-Onayı',
    summary: 'Müşterinin kendi onayladığı randevular — telefonla arama gerekmiyor.',
    steps: [
      'appointments.confirmation_status = "confirmed_by_customer" sayılır',
      'Manuel onay için müşteriyi arama ~3 dk alırdı',
    ],
    assumption: 'Onay araması başına 3 dakika',
  },
  ai_actions: {
    title: 'AI Asistan Eylemleri',
    summary: 'AI asistanın sizin yerinize tamamladığı işler (randevu oluşturma, yanıt verme, analiz).',
    steps: [
      'ai_pending_actions.status = "executed" olanlar sayılır',
      'Her eylem manuel yapılsa ~5 dk sürerdi',
    ],
    assumption: 'AI eylemi başına 5 dakika',
  },
  system_messages: {
    title: 'Otomatik Sistem Mesajları',
    summary: 'Randevu onay, teşekkür, bildirim gibi otomatik sistem mesajları.',
    steps: [
      'messages.message_type = "system" AND direction = "outbound" sayılır',
      'Her mesaj manuel yazılsa ~1 dk sürerdi',
    ],
    assumption: 'Sistem mesajı başına 1 dakika',
  },
  follow_ups: {
    title: 'Takip Kuyruğu Gönderimleri',
    summary: 'Seans sonrası otomatik takip mesajları.',
    steps: [
      'follow_up_queue.status = "sent" olanlar sayılır',
      'Manuel takip araması/mesajı ~3 dk alırdı',
    ],
    assumption: 'Takip başına 3 dakika',
  },

  // ═══ Grup 2: Dijital Kanal Geliri ═══
  web_appointments: {
    title: 'Online Randevu (Link)',
    summary: 'Müşterinin kendi aldığı, telefon gerektirmeyen online randevular.',
    steps: [
      'appointments.source = "web" olanlar sayılır',
      'Bağlı hizmet fiyatlarının toplamı gösterilir',
    ],
    assumption: 'Bu müşterilerin çoğu telefon edemese randevu alamazdı.',
  },
  ai_appointments: {
    title: 'AI Asistan Randevuları',
    summary: 'AI asistan tarafından WhatsApp/SMS üzerinden oluşturulan randevular.',
    steps: [
      'appointments.source = "ai_assistant" olanlar sayılır',
      'Bağlı hizmet fiyatlarının toplamı gösterilir',
    ],
    assumption: 'AI olmasa bu konuşmaların manuel dönüşü zaman alırdı.',
  },
  gap_fill: {
    title: 'Gap-Fill (Boş Slot Doldurma)',
    summary: 'Boş kalabilecek slotlara gönderilen bildirim sonrası oluşan randevular.',
    steps: [
      'gap_fill_notifications → appointment_id olanlar',
      'Bağlı randevunun hizmet fiyatı sayılır',
    ],
    assumption: 'Bu slotlar bildirim olmasa muhtemelen boş kalırdı.',
  },
  campaign_sourced: {
    title: 'Kampanya Kaynaklı Randevu',
    summary: 'Kampanya (winback/promosyon) alıcısının 30 gün içinde aldığı randevular.',
    steps: [
      'campaign_recipients.status = "sent" olanlar',
      'Alıcının sent_at sonrası 30 gün içinde aldığı randevular attribute edilir',
    ],
    assumption: 'Indirect attribution — 30 günlük pencere içinde sayılır.',
  },

  // ═══ Grup 3: Müşteri Büyüme & Geri Dönüş ═══
  referrals_converted: {
    title: 'Referans Dönüşümü',
    summary: 'Mevcut müşterinin tavsiyesiyle gelen yeni müşteriler.',
    steps: [
      'referrals.status IN ("converted", "rewarded") olanlar',
      'Reward_value toplamı gösterilir',
    ],
    assumption: 'Referans özelliği olmasa bu müşteriler gelmeyebilirdi.',
  },
  winback_recovered: {
    title: 'Winback ile Geri Dönüş',
    summary: 'Winback kampanyası sonrası iletişime geçilen müşteri sayısı.',
    steps: [
      'campaigns.type = "winback" sent_count toplamı',
    ],
    assumption: 'Lost/risk segmentine düşen müşterilere ulaşma otomatik.',
  },
  rewards_used: {
    title: 'Ödül Kullanımı',
    summary: 'Verilen ödüllerin kullanım sayısı — müşteriyi tekrar getirdi.',
    steps: [
      'customer_rewards.status = "used" olanlar sayılır',
    ],
  },
  birthday_driven: {
    title: 'Doğum Günü Mesajları',
    summary: 'Otomatik gönderilen doğum günü kampanyası mesajları.',
    steps: [
      'messages.message_type = "birthday" sayılır',
    ],
    assumption: 'Manuel doğum günü takibi işletme için büyük yük.',
  },

  // ═══ Grup 4: Müşteri Deneyimi & Dijitalleşme ═══
  review_requests: {
    title: 'Otomatik Yorum Talepleri',
    summary: 'Randevu sonrası otomatik gönderilen yorum isteme mesajları.',
    steps: [
      'appointments.review_requested = true sayılır',
    ],
  },
  reviews_received: {
    title: 'Alınan Yorumlar',
    summary: 'Bu dönemde müşteri yorumları ve ortalama puanı.',
    steps: [
      'reviews tablosu dönem filtresiyle sayılır',
      'Ortalama rating hesaplanır',
    ],
  },
  pos_transactions: {
    title: 'Kasa Dijital İşlemleri',
    summary: 'POS modülü üzerinden yapılan dijital kasa işlemleri.',
    steps: [
      'pos_transactions count + total sum',
    ],
    assumption: 'Manuel defter tutmanın yerini alır.',
  },
  periodic_reminders: {
    title: 'Periyodik Kontrol Hatırlatmaları',
    summary: 'Müşteriye düzenli kontrol için otomatik gönderilen hatırlatmalar.',
    steps: [
      'periodic_reminders_sent tablosu dönem filtresiyle sayılır',
    ],
  },
  workflow_runs: {
    title: 'Workflow Tamamlanmaları',
    summary: 'Tanımlı iş akışlarının otomatik tamamlanma sayısı.',
    steps: [
      'workflow_runs.status = "completed" sayılır',
    ],
  },
}
