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
    summary: 'PulseApp’in sizin yerinize yaptığı işler için harcamanız gerekecek tahmini süre.',
    steps: [
      'Gönderilen her hatırlatma için ~2 dakika (numara bulma, mesaj yazma, gönderme)',
      'Müşterinin kendi onayladığı her randevu için ~3 dakika (telefonla aramak yerine)',
      'AI asistanın tamamladığı her eylem için ~5 dakika',
      'Otomatik sistem mesajları için ~1 dakika',
      'Takip mesajları için ~3 dakika',
    ],
    assumption: 'Bu süreler sizin ya da personelinizin ortalama olarak harcayacağı zamandır. İşletmenize göre az çok değişebilir.',
  },
  saved_money: {
    title: 'Zaman → Para',
    summary: 'Kazanılan sürenin işletmeniz için ne kadar para değerinde olduğunun kaba tahmini.',
    steps: [
      'Toplam kazanılan dakika 60’a bölünür → saat',
      'Her saat için yaklaşık 30 ₺ iş maliyeti hesaplanır',
    ],
    assumption: 'Saatlik iş maliyeti 30 ₺ olarak varsayılmıştır (sektör ortalaması). İşletmenize göre değişebilir.',
  },
  digital_revenue: {
    title: 'Dijital Kanal Geliri',
    summary: 'PulseApp olmasa büyük ihtimalle hiç oluşmayacak ya da çok geç oluşacak randevu gelirleri.',
    steps: [
      'Web üzerinden (randevu linki) alınan randevuların geliri',
      'AI asistanın WhatsApp/SMS konuşmasından oluşturduğu randevuların geliri',
      'Boş slotlara gönderilen bildirim sonrası dolan randevuların geliri',
      'Gönderdiğiniz kampanya mesajını alan müşterilerin 30 gün içinde aldığı randevuların geliri',
    ],
    assumption: 'Sadece platform olmadan oluşması zor olan gelir sayılır; mevcut müşterinin zaten gelecek randevusu buraya yazılmaz.',
  },
  new_returning: {
    title: 'Yeni / Geri Dönen Müşteri',
    summary: 'PulseApp özellikleri sayesinde işletmenize gelen ya da geri dönen müşteri sayısı.',
    steps: [
      'Referans (tavsiye) sistemi üzerinden gelen yeni müşteriler',
      'Winback kampanyası ile ulaşılan, geri dönen müşteriler',
    ],
    assumption: 'Bu müşteriler platformun ilgili özellikleri olmadan çok büyük ihtimalle işletmenize ulaşmayacaktı.',
  },

  // ═══ Grup 1: Otomasyon Kazanımları ═══
  reminders_24h: {
    title: '24 Saat Öncesi Hatırlatma',
    summary: 'Randevudan 1 gün önce müşterilere otomatik gönderilen hatırlatma mesajları.',
    steps: [
      'Otomatik gönderilen 24 saat hatırlatmaları sayılır',
      'Her birini manuel göndermek ortalama 2 dakika sürerdi',
    ],
    assumption: 'Hatırlatma başına 2 dakika (numara bul, mesaj yaz, gönder).',
  },
  reminders_2h: {
    title: '2 Saat Öncesi Hatırlatma',
    summary: 'Randevudan kısa süre önce gönderilen son dakika hatırlatmaları — no-show’u azaltır.',
    steps: [
      'Otomatik gönderilen 2 saat hatırlatmaları sayılır',
      'Her birini manuel göndermek ortalama 2 dakika sürerdi',
    ],
    assumption: 'Hatırlatma başına 2 dakika.',
  },
  self_confirmations: {
    title: 'Müşteri Self-Onayı',
    summary: 'Müşterinin kendi onayladığı randevular — telefonla arama ihtiyacı kalmaz.',
    steps: [
      'Müşterinin kendi linkten onayladığı randevular sayılır',
      'Her onayı telefonla almak ortalama 3 dakika sürerdi',
    ],
    assumption: 'Onay araması başına 3 dakika.',
  },
  ai_actions: {
    title: 'AI Asistan Eylemleri',
    summary: 'AI asistanın sizin yerinize tamamladığı işler: randevu oluşturma, yanıt verme, analiz.',
    steps: [
      'AI asistanın başarıyla tamamladığı eylemler sayılır',
      'Her eylemi manuel yapmak ortalama 5 dakika sürerdi',
    ],
    assumption: 'AI eylemi başına 5 dakika.',
  },
  system_messages: {
    title: 'Otomatik Sistem Mesajları',
    summary: 'Randevu onay, teşekkür, bildirim gibi durumlarda otomatik gönderilen mesajlar.',
    steps: [
      'Sistem tarafından gönderilen otomatik mesajlar sayılır',
      'Her mesajı manuel yazmak ortalama 1 dakika sürerdi',
    ],
    assumption: 'Mesaj başına 1 dakika.',
  },
  follow_ups: {
    title: 'Takip Kuyruğu Gönderimleri',
    summary: 'Randevu/seans sonrası müşteriye otomatik gönderilen takip mesajları.',
    steps: [
      'Takip kuyruğundan gönderilen mesajlar sayılır',
      'Her takibi manuel yapmak ortalama 3 dakika alırdı',
    ],
    assumption: 'Takip başına 3 dakika.',
  },

  // ═══ Grup 2: Dijital Kanal Geliri ═══
  web_appointments: {
    title: 'Online Randevu (Link)',
    summary: 'Müşterinin randevu linki üzerinden kendi kendine aldığı randevular.',
    steps: [
      'Online link üzerinden alınan randevular sayılır',
      'Bu randevuların hizmet fiyatları toplanır',
    ],
    assumption: 'Bu müşterilerin önemli bir kısmı telefon etmek zorunda kalsa randevu almayabilir ya da rakibe gidebilirdi.',
  },
  ai_appointments: {
    title: 'AI Asistan Randevuları',
    summary: 'AI asistanın WhatsApp/SMS üzerinden konuşarak oluşturduğu randevular.',
    steps: [
      'AI asistanın oluşturduğu randevular sayılır',
      'Bu randevuların hizmet fiyatları toplanır',
    ],
    assumption: 'AI asistan olmasa bu konuşmalara manuel yanıt verme süresi yüzünden bir kısım kaybedilecekti.',
  },
  gap_fill: {
    title: 'Gap-Fill (Boş Slot Doldurma)',
    summary: 'Müsait kalan slota bildirim gönderilerek doldurulan randevular.',
    steps: [
      'Bildirim gönderilip randevuya dönüşen slotlar sayılır',
      'Dolan randevuların hizmet fiyatları toplanır',
    ],
    assumption: 'Bu slotlar bildirim gitmese büyük ihtimalle boş kalırdı.',
  },
  campaign_sourced: {
    title: 'Kampanya Kaynaklı Randevu',
    summary: 'Kampanya mesajını alan müşterinin 30 gün içinde aldığı randevular.',
    steps: [
      'Kampanya mesajı gönderilen müşteriler bulunur',
      'Bu müşterilerin mesajdan sonraki 30 gün içindeki randevuları sayılır',
      'Hizmet fiyatları toplanır',
    ],
    assumption: 'Dolaylı ilişki — 30 gün penceresi kullanılır. Bazı randevular yine de alınırdı, hepsi kampanyaya bağlı değildir.',
  },

  // ═══ Grup 3: Müşteri Büyüme & Geri Dönüş ═══
  referrals_converted: {
    title: 'Referans Dönüşümü',
    summary: 'Mevcut müşterinin tavsiyesiyle işletmenize gelen yeni müşteriler.',
    steps: [
      'Referans sisteminde tavsiye eden kişiden gelip randevu alan müşteriler sayılır',
      'Verilen ödül değeri toplanır',
    ],
    assumption: 'Referans özelliği olmasa bu müşterilerin bir kısmı işletmenizi duymayabilirdi.',
  },
  winback_recovered: {
    title: 'Geri Kazanım',
    summary: 'Uzun süredir gelmeyen müşteriye otomatik hatırlatma gönderip geri kazandığımız kişiler.',
    steps: [
      'Geri kazanım tipindeki kampanyaların ulaştığı müşteri sayısı toplanır',
    ],
    assumption: 'Kayıp/risk segmentindeki müşterilere otomatik ulaşma işi yapılır.',
  },
  rewards_used: {
    title: 'Ödül Kullanımı',
    summary: 'Verilen ödüllerin müşteriler tarafından kullanılma sayısı — tekrar getirdi.',
    steps: [
      'Kullanılmış ödüller sayılır',
    ],
    assumption: 'Ödül kullanan her müşteri işletmenize ekstra ziyaret yaptı demektir.',
  },
  birthday_driven: {
    title: 'Doğum Günü Mesajları',
    summary: 'Müşterinin doğum gününde otomatik gönderilen kutlama/kampanya mesajları.',
    steps: [
      'Gönderilen doğum günü mesajları sayılır',
    ],
    assumption: 'Manuel takibi çok zor olan bir iş — otomatik yapılmasa unutulurdu.',
  },

  // ═══ Grup 4: Müşteri Deneyimi & Dijitalleşme ═══
  review_requests: {
    title: 'Otomatik Yorum Talepleri',
    summary: 'Randevu sonrası müşteriden yorum isteyen otomatik mesajlar.',
    steps: [
      'Yorum talebi gönderilen randevular sayılır',
    ],
    assumption: 'Manuel gönderilmesi zor olduğundan yorum sayısı sınırlı kalırdı.',
  },
  reviews_received: {
    title: 'Alınan Yorumlar',
    summary: 'Bu dönemde gelen müşteri yorumları ve ortalama puanınız.',
    steps: [
      'Bu dönemdeki müşteri yorumları sayılır',
      'Ortalama yıldız puanı hesaplanır',
    ],
  },
  pos_transactions: {
    title: 'Kasa (POS) İşlemleri',
    summary: 'POS modülü üzerinden kaydedilen dijital kasa işlemleri.',
    steps: [
      'Kasa işlem sayısı ve toplam tutar gösterilir',
    ],
    assumption: 'Defter tutma / hesaplama zamanınızı kısaltır; gelir kayıtlarınız otomatik takip edilir.',
  },
  periodic_reminders: {
    title: 'Periyodik Kontrol Hatırlatmaları',
    summary: 'Düzenli tekrar eden hizmetler için müşterilere otomatik gönderilen kontrol hatırlatmaları.',
    steps: [
      'Otomatik gönderilen periyodik hatırlatmalar sayılır',
    ],
    assumption: 'Özellikle sağlık/bakım işletmeleri için — müşterinin gelme sıklığını artırır.',
  },
  workflow_runs: {
    title: 'Workflow Tamamlanmaları',
    summary: 'Tanımladığınız otomasyon akışlarının başarıyla tamamlanma sayısı.',
    steps: [
      'Başarıyla tamamlanan iş akışları sayılır',
    ],
  },
}
