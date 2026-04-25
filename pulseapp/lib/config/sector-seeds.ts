import type { CustomerSegment, RewardType, SectorType } from '@/types'

/**
 * Onboarding sırasında işletmenin sektörüne göre otomatik eklenen örnek içerikler.
 * Amaç: kullanıcı ilk kez dashboard'a girdiğinde hizmetler, otomatik mesajlar ve
 * paket/seans tanımları boş olmasın — sektörüne uygun başlangıç seti hazır gelsin.
 *
 * Ekleme sırası: önce services (id'ler toplanır), sonra service_packages (service_id ile
 * eşlenir) ve workflows.
 */

export interface SeedService {
  key: string                       // paket tarafında service_id eşlemesi için
  name: string
  description?: string
  duration_minutes: number
  price: number
  sort_order?: number
  recommended_interval_days?: number | null
}

export interface SeedPackage {
  name: string
  description?: string
  service_key?: string              // hangi seed service'e bağlı (null = serbest)
  sessions_total: number
  price: number
  validity_days?: number | null
  sort_order?: number
}

export interface SeedWorkflowStep {
  delay_hours: number
  message: string
}

export interface SeedWorkflow {
  name: string
  trigger_type: 'appointment_completed' | 'appointment_cancelled' | 'customer_created' | 'no_show' | 'birthday'
  is_active: boolean
  steps: SeedWorkflowStep[]
}

/**
 * Kurulum sihirbazının "Ödüller" adımında sektörüne göre önerilen
 * preset ödül şablonu. `trigger` / `triggerValue` alanları yalnızca UI
 * açıklaması olarak kullanılır (DB'deki `rewards` tablosunda birebir kolon yok);
 * kullanıcı seçip onayladığında bu bilgi `description` içine gömülüp yazılır.
 */
export interface SeedReward {
  name: string
  description: string
  rewardType: RewardType
  value: number
  validDays: number
  // UI göstergesi — "10. ziyaret", "doğum günü" gibi
  triggerLabel: string
}

/**
 * Kurulum sihirbazının "Kampanyalar" adımında sektörüne göre önerilen
 * taslak kampanya. DB'ye `campaigns` tablosuna `status='draft'` ile yazılır.
 */
export interface SeedCampaign {
  name: string
  description: string
  discountPercent?: number
  targetSegments: CustomerSegment[] | null  // null = tüm müşteriler (segment filtresi yok)
  messageTemplate: string
}

export interface SectorSeed {
  services: SeedService[]
  packages: SeedPackage[]
  workflows: SeedWorkflow[]
  rewards: SeedReward[]
  campaigns: SeedCampaign[]
  /**
   * Personel etiket havuzu önerisi — onboarding'de "Personel Etiketleri" adımında
   * default olarak işaretli gelir. Kullanıcı çıkarıp custom ekleyebilir.
   * Sonuç `businesses.settings.staff_tag_options` JSONB array'e yazılır.
   */
  staff_tags: string[]
}

// ────────────────────────────────────────────────────────────────────────────
// Diş Kliniği
// ────────────────────────────────────────────────────────────────────────────
const DENTAL_CLINIC_SEED: SectorSeed = {
  services: [
    { key: 'muayene',    name: 'Muayene & Kontrol',    description: 'Genel diş muayenesi ve tedavi planı.', duration_minutes: 30, price: 300,   sort_order: 0, recommended_interval_days: 180 },
    { key: 'temizlik',   name: 'Diş Temizliği',        description: 'Diş taşı ve plak temizliği, parlatma.', duration_minutes: 45, price: 800,   sort_order: 1, recommended_interval_days: 180 },
    { key: 'dolgu',      name: 'Dolgu',                description: 'Kompozit (beyaz) dolgu uygulaması.',    duration_minutes: 60, price: 1500,  sort_order: 2 },
    { key: 'kanal',      name: 'Kanal Tedavisi',       description: 'Tek kök kanal tedavisi.',               duration_minutes: 90, price: 3500,  sort_order: 3 },
    { key: 'cekim',      name: 'Diş Çekimi',           description: 'Basit diş çekimi.',                     duration_minutes: 30, price: 1200,  sort_order: 4 },
    { key: 'beyazlatma', name: 'Diş Beyazlatma',       description: 'Ofis tipi beyazlatma seansı.',          duration_minutes: 60, price: 3000,  sort_order: 5 },
    { key: 'implant',    name: 'İmplant',              description: 'Tek diş implant uygulaması.',            duration_minutes: 120, price: 15000, sort_order: 6 },
    { key: 'ortodonti',  name: 'Ortodonti Kontrolü',   description: 'Tel/plak kontrolü ve tel değişimi.',     duration_minutes: 30, price: 600,   sort_order: 7, recommended_interval_days: 30 },
  ],
  packages: [
    { name: '6 Aylık Bakım Paketi', description: 'Yılda 2 kez muayene + temizlik.', service_key: 'temizlik',  sessions_total: 2, price: 1800,  validity_days: 365, sort_order: 0 },
    { name: 'Beyazlatma + Temizlik', description: 'Ofis beyazlatma öncesi temizlik dahil.', service_key: 'beyazlatma', sessions_total: 2, price: 3500,  validity_days: 180, sort_order: 1 },
    { name: 'İmplant Takip Paketi', description: 'Operasyon sonrası 3 kontrol seansı.',   service_key: 'implant',    sessions_total: 3, price: 16500, validity_days: 365, sort_order: 2 },
  ],
  workflows: [
    {
      name: 'Randevu Sonrası Teşekkür & Kontrol Hatırlatma',
      trigger_type: 'appointment_completed',
      is_active: true,
      steps: [
        { delay_hours: 2,    message: 'Bizi tercih ettiğiniz için teşekkür ederiz. Diş sağlığınızla ilgili sorunuz olursa yazabilirsiniz.' },
        { delay_hours: 4320, message: '6 aylık rutin kontrol zamanınız yaklaştı. Randevu oluşturmak için bizi arayabilirsiniz.' },
      ],
    },
    {
      name: 'Gelmedi Durumunda Nazik Hatırlatma',
      trigger_type: 'no_show',
      is_active: true,
      steps: [
        { delay_hours: 2, message: 'Bugünkü randevunuza gelemediğinizi fark ettik. Yeni bir randevu oluşturmak ister misiniz?' },
      ],
    },
    {
      name: 'Yeni Hasta Karşılama',
      trigger_type: 'customer_created',
      is_active: true,
      steps: [
        { delay_hours: 0, message: 'Aramıza hoş geldiniz! Randevularınız ve tedavi planınız için her zaman ulaşabilirsiniz.' },
      ],
    },
    {
      name: 'Doğum Günü Kutlaması',
      trigger_type: 'birthday',
      is_active: true,
      steps: [
        { delay_hours: 0, message: 'Doğum gününüz kutlu olsun! Bu ay içinde alacağınız temizlik randevusunda %15 indirim hediyemiz olsun.' },
      ],
    },
  ],
  rewards: [
    {
      name: 'Yıllık Ücretsiz Kontrol',
      description: 'Yılda bir kez ücretsiz muayene hediyesi.',
      rewardType: 'free_service',
      value: 0,
      validDays: 365,
      triggerLabel: '10. ziyarette',
    },
    {
      name: 'Arkadaş Tavsiye İndirimi',
      description: 'Yeni hasta getiren hastalara %15 indirim.',
      rewardType: 'discount_percent',
      value: 15,
      validDays: 90,
      triggerLabel: 'Tavsiye başına',
    },
    {
      name: 'Doğum Günü Hediyesi',
      description: 'Doğum ayında ücretsiz diş taşı temizliği.',
      rewardType: 'free_service',
      value: 0,
      validDays: 30,
      triggerLabel: 'Doğum gününde',
    },
  ],
  campaigns: [
    {
      name: 'Bahar Temizlik Kampanyası',
      description: 'Tüm hastalar için bahar dönemi diş taşı temizliği indirimi.',
      discountPercent: 20,
      targetSegments: null,
      messageTemplate: 'Merhaba {name}, bahar geldi! Diş taşı temizliği randevunuzda %20 indirim sizi bekliyor. Randevu: {link}',
    },
    {
      name: 'Beyazlatma + Kontrol Paketi',
      description: 'Yeni ve düzenli hastalara özel kombine paket indirimi.',
      discountPercent: 30,
      targetSegments: ['new', 'regular'],
      messageTemplate: 'Merhaba {name}, beyazlatma + kontrol paketimizde %30 indirim! Detay: {link}',
    },
    {
      name: '6 Aylık Kontrol Hatırlatma Bonusu',
      description: 'Son 6 aydır gelmemiş hastalara kontrol randevusunda bonus.',
      discountPercent: 15,
      targetSegments: ['risk', 'lost'],
      messageTemplate: 'Sizi özledik {name}! 6 aylık rutin kontrolünüzde %15 indirim hediyemiz olsun. Randevu: {link}',
    },
    {
      name: 'İmplant Danışmanlığı Ücretsiz',
      description: 'İmplant düşünen hastalara ücretsiz konsültasyon kampanyası.',
      targetSegments: null,
      messageTemplate: 'Merhaba {name}, implant tedavisini merak ediyorsanız ücretsiz konsültasyon için bize ulaşın: {link}',
    },
  ],
  staff_tags: ['Doktor', 'Hemşire', 'Asistan', 'Resepsiyon'],
}

// ────────────────────────────────────────────────────────────────────────────
// Estetik Klinik
// ────────────────────────────────────────────────────────────────────────────
const MEDICAL_AESTHETIC_SEED: SectorSeed = {
  services: [
    { key: 'konsultasyon', name: 'Konsültasyon',             description: 'Tedavi öncesi değerlendirme ve plan.',     duration_minutes: 30, price: 500,   sort_order: 0 },
    { key: 'botoks',       name: 'Botoks',                   description: 'Mimik hatları için botulinum uygulaması.', duration_minutes: 60, price: 5000,  sort_order: 1, recommended_interval_days: 180 },
    { key: 'dolgu',        name: 'Dolgu (Filler)',           description: 'Dudak/çene/yanak hyaluronik asit dolgusu.', duration_minutes: 60, price: 6000,  sort_order: 2, recommended_interval_days: 270 },
    { key: 'mezoterapi',   name: 'Mezoterapi',               description: 'Cilt canlandırıcı karışım enjeksiyonu.',   duration_minutes: 45, price: 2500,  sort_order: 3 },
    { key: 'lazer',        name: 'Lazer Epilasyon (Bölge)',  description: 'Tekli bölge lazer epilasyon seansı.',      duration_minutes: 30, price: 1500,  sort_order: 4 },
    { key: 'cilt_bakim',   name: 'Cilt Bakımı',              description: 'Temizlik, peeling ve maske içeren klasik bakım.', duration_minutes: 60, price: 1800, sort_order: 5 },
    { key: 'peeling',      name: 'Kimyasal Peeling',         description: 'Leke/yenileme amaçlı kimyasal peeling.',   duration_minutes: 45, price: 2200,  sort_order: 6 },
    { key: 'prp',          name: 'PRP Tedavisi',             description: 'Cilt / saç PRP uygulaması.',               duration_minutes: 60, price: 3500,  sort_order: 7 },
  ],
  packages: [
    { name: '5 Seans Lazer Epilasyon', description: 'Tek bölge için 5 seans lazer paketi.',   service_key: 'lazer',      sessions_total: 5, price: 6000,  validity_days: 365, sort_order: 0 },
    { name: '3 Seans Mezoterapi',      description: 'Cilt canlandırma mezoterapi kürü.',      service_key: 'mezoterapi', sessions_total: 3, price: 6000,  validity_days: 180, sort_order: 1 },
    { name: '4 Seans PRP',             description: 'Cilt / saç PRP paket uygulaması.',       service_key: 'prp',        sessions_total: 4, price: 12000, validity_days: 365, sort_order: 2 },
    { name: 'Cilt Bakım Paketi',       description: '5 seanslık kombine cilt bakım paketi.',  service_key: 'cilt_bakim', sessions_total: 5, price: 7500,  validity_days: 365, sort_order: 3 },
  ],
  workflows: [
    {
      name: 'İşlem Sonrası Bakım Talimatları',
      trigger_type: 'appointment_completed',
      is_active: true,
      steps: [
        { delay_hours: 2,   message: 'Uygulama sonrası 24 saat güneşe çıkmamanızı, sıcak ortamdan uzak durmanızı öneririz. Sorunuz olursa yazabilirsiniz.' },
        { delay_hours: 72,  message: 'Uygulama sonrası 3. günündesiniz. Her şey yolunda mı? Yan etki fark ederseniz hemen bildirebilirsiniz.' },
        { delay_hours: 720, message: 'Kontrol randevunuz yaklaşıyor. Size uygun bir gün için randevu oluşturalım mı?' },
      ],
    },
    {
      name: 'Gelmedi Durumunda Nazik Hatırlatma',
      trigger_type: 'no_show',
      is_active: true,
      steps: [
        { delay_hours: 2, message: 'Bugünkü randevunuza gelemediğinizi fark ettik. Size yeni bir tarih ayarlayalım mı?' },
      ],
    },
    {
      name: 'Yeni Hasta Karşılama',
      trigger_type: 'customer_created',
      is_active: true,
      steps: [
        { delay_hours: 0, message: 'Aramıza hoş geldiniz! Ücretsiz konsültasyon için dilediğiniz zaman ulaşabilirsiniz.' },
      ],
    },
    {
      name: 'Doğum Günü Kutlaması',
      trigger_type: 'birthday',
      is_active: true,
      steps: [
        { delay_hours: 0, message: 'Doğum gününüz kutlu olsun! Bu ay içinde alacağınız uygulamalarda %10 indirim hediyemiz olsun.' },
      ],
    },
  ],
  rewards: [
    {
      name: '10. Seansta %20 İndirim',
      description: '10. uygulamasını tamamlayan hastalara %20 indirim.',
      rewardType: 'discount_percent',
      value: 20,
      validDays: 60,
      triggerLabel: '10. ziyarette',
    },
    {
      name: 'Arkadaş Getirene Ücretsiz Mezoterapi',
      description: '5 yeni hasta tavsiye edene bir seans ücretsiz mezoterapi.',
      rewardType: 'free_service',
      value: 0,
      validDays: 180,
      triggerLabel: '5 tavsiye sonrası',
    },
    {
      name: 'Doğum Günü Hediyesi',
      description: 'Doğum ayında ürün/uygulama hediyesi.',
      rewardType: 'gift',
      value: 0,
      validDays: 30,
      triggerLabel: 'Doğum gününde',
    },
  ],
  campaigns: [
    {
      name: 'İlk Seans %20 İndirim',
      description: 'Yeni hastalar için ilk uygulama indirimi.',
      discountPercent: 20,
      targetSegments: ['new'],
      messageTemplate: 'Hoş geldiniz {name}! İlk seansınızda %20 indirim sizi bekliyor. Randevu: {link}',
    },
    {
      name: 'Yaza Hazırlık: Lazer Epilasyon',
      description: 'Lazer paketlerinde sezon indirimi.',
      discountPercent: 15,
      targetSegments: null,
      messageTemplate: 'Merhaba {name}, yaz yaklaşıyor! Lazer epilasyon paketlerinde %15 indirim. Detay: {link}',
    },
    {
      name: 'Dolguda 2. Seans Hediye',
      description: 'Düzenli hastalara dolgu paketi promosyonu.',
      targetSegments: ['regular'],
      messageTemplate: 'Merhaba {name}, bu ay dolgu uygulamanıza 2. seans hediye. Randevu: {link}',
    },
    {
      name: 'VIP Hastalarımıza Özel PRP',
      description: 'VIP segment için PRP uygulamasında %25 indirim.',
      discountPercent: 25,
      targetSegments: ['vip'],
      messageTemplate: 'Değerli hastamız {name}, PRP uygulamanızda size özel %25 indirim hazırladık. Detay: {link}',
    },
  ],
  staff_tags: ['Doktor', 'Hemşire', 'Asistan', 'Resepsiyon'],
}

// ────────────────────────────────────────────────────────────────────────────
// Diğer sektörler için hafif seed'ler — sadece hizmet + etiket önerisi.
// Onboarding'de bu sektör seçildiğinde preset chip'leri olarak gösterilir.
// Paket/workflow/reward/campaign önerileri ileride genişletilebilir.
// ────────────────────────────────────────────────────────────────────────────
function makeLightSeed(services: SeedService[], staff_tags: string[]): SectorSeed {
  return {
    services,
    packages: [],
    workflows: [],
    rewards: [],
    campaigns: [],
    staff_tags,
  }
}

const HAIR_SALON_SEED = makeLightSeed(
  [
    { key: 'kesim',    name: 'Saç Kesimi',  duration_minutes: 45, price: 250,  sort_order: 0 },
    { key: 'boyama',   name: 'Saç Boyama',  duration_minutes: 90, price: 800,  sort_order: 1 },
    { key: 'rofle',    name: 'Röfle / Balyaj', duration_minutes: 120, price: 1200, sort_order: 2 },
    { key: 'fon',      name: 'Fön',         duration_minutes: 30, price: 200,  sort_order: 3 },
    { key: 'manikur',  name: 'Manikür',     duration_minutes: 30, price: 300,  sort_order: 4 },
    { key: 'pedikur',  name: 'Pedikür',     duration_minutes: 45, price: 350,  sort_order: 5 },
    { key: 'kas',      name: 'Kaş Tasarımı', duration_minutes: 15, price: 150, sort_order: 6 },
  ],
  ['Stilist', 'Asistan', 'Çırak'],
)

const BARBER_SEED = makeLightSeed(
  [
    { key: 'kesim',     name: 'Saç Kesimi',     duration_minutes: 30, price: 200, sort_order: 0 },
    { key: 'sakal',     name: 'Sakal Tıraşı',   duration_minutes: 20, price: 100, sort_order: 1 },
    { key: 'sac_sakal', name: 'Saç + Sakal',    duration_minutes: 45, price: 280, sort_order: 2 },
    { key: 'yuz_bakim', name: 'Yüz Bakımı',     duration_minutes: 30, price: 200, sort_order: 3 },
  ],
  ['Berber', 'Çırak'],
)

const BEAUTY_SALON_SEED = makeLightSeed(
  [
    { key: 'cilt',     name: 'Cilt Bakımı',    duration_minutes: 60, price: 700,  sort_order: 0 },
    { key: 'manikur',  name: 'Manikür',        duration_minutes: 30, price: 250,  sort_order: 1 },
    { key: 'pedikur',  name: 'Pedikür',        duration_minutes: 45, price: 300,  sort_order: 2 },
    { key: 'kas',      name: 'Kaş Tasarımı',   duration_minutes: 15, price: 150,  sort_order: 3 },
    { key: 'kirpik',   name: 'Kirpik Lifting', duration_minutes: 60, price: 600,  sort_order: 4 },
    { key: 'epilasyon', name: 'Ağda',          duration_minutes: 45, price: 400,  sort_order: 5 },
  ],
  ['Estetisyen', 'Asistan'],
)

const PHYSIOTHERAPY_SEED = makeLightSeed(
  [
    { key: 'manuel',   name: 'Manuel Terapi',     duration_minutes: 60, price: 800, sort_order: 0 },
    { key: 'egzersiz', name: 'Egzersiz Tedavisi', duration_minutes: 60, price: 600, sort_order: 1 },
    { key: 'elektro',  name: 'Elektroterapi',     duration_minutes: 30, price: 400, sort_order: 2 },
    { key: 'masaj',    name: 'Tedavi Masajı',     duration_minutes: 45, price: 500, sort_order: 3 },
  ],
  ['Fizyoterapist', 'Asistan'],
)

const VETERINARY_SEED = makeLightSeed(
  [
    { key: 'muayene',     name: 'Muayene',          duration_minutes: 20, price: 350,  sort_order: 0 },
    { key: 'asi',         name: 'Aşı',              duration_minutes: 15, price: 250,  sort_order: 1 },
    { key: 'kisirlastir', name: 'Kısırlaştırma',    duration_minutes: 90, price: 2500, sort_order: 2 },
    { key: 'dis',         name: 'Diş Bakımı',       duration_minutes: 45, price: 800,  sort_order: 3 },
    { key: 'tiras',       name: 'Tıraş & Bakım',    duration_minutes: 60, price: 400,  sort_order: 4 },
  ],
  ['Veteriner', 'Veteriner Asistanı'],
)

const PSYCHOLOGIST_SEED = makeLightSeed(
  [
    { key: 'bireysel', name: 'Bireysel Terapi',  duration_minutes: 50, price: 1200, sort_order: 0 },
    { key: 'cift',     name: 'Çift Terapisi',    duration_minutes: 75, price: 1800, sort_order: 1 },
    { key: 'aile',     name: 'Aile Terapisi',    duration_minutes: 75, price: 1800, sort_order: 2 },
    { key: 'cocuk',    name: 'Çocuk Terapisi',   duration_minutes: 50, price: 1200, sort_order: 3 },
  ],
  ['Psikolog', 'Psikiyatrist'],
)

const SPA_MASSAGE_SEED = makeLightSeed(
  [
    { key: 'klasik',    name: 'Klasik Masaj',    duration_minutes: 60, price: 700, sort_order: 0 },
    { key: 'aromaterapi', name: 'Aromaterapi',   duration_minutes: 60, price: 800, sort_order: 1 },
    { key: 'hot_stone', name: 'Sıcak Taş Masajı', duration_minutes: 75, price: 900, sort_order: 2 },
    { key: 'reflex',    name: 'Refleksoloji',     duration_minutes: 45, price: 500, sort_order: 3 },
  ],
  ['Masöz', 'Spa Terapisti'],
)

const FITNESS_SEED = makeLightSeed(
  [
    { key: 'pt',     name: 'Kişisel Antrenman',  duration_minutes: 60, price: 400, sort_order: 0 },
    { key: 'grup',   name: 'Grup Dersi',         duration_minutes: 45, price: 200, sort_order: 1 },
    { key: 'beslenme', name: 'Beslenme Danışmanlığı', duration_minutes: 30, price: 300, sort_order: 2 },
  ],
  ['Antrenör', 'Eğitmen', 'Resepsiyon'],
)

const YOGA_PILATES_SEED = makeLightSeed(
  [
    { key: 'pilates', name: 'Pilates Reformer', duration_minutes: 50, price: 350, sort_order: 0 },
    { key: 'mat',     name: 'Mat Pilates',      duration_minutes: 50, price: 250, sort_order: 1 },
    { key: 'yoga',    name: 'Yoga',             duration_minutes: 60, price: 250, sort_order: 2 },
  ],
  ['Eğitmen', 'Yoga Hocası'],
)

const TATTOO_PIERCING_SEED = makeLightSeed(
  [
    { key: 'tattoo_kucuk', name: 'Küçük Dövme',  duration_minutes: 60,  price: 1000, sort_order: 0 },
    { key: 'tattoo_orta',  name: 'Orta Dövme',   duration_minutes: 120, price: 2500, sort_order: 1 },
    { key: 'piercing',     name: 'Piercing',     duration_minutes: 30,  price: 500,  sort_order: 2 },
  ],
  ['Dövme Sanatçısı', 'Piercer'],
)

const DIETITIAN_SEED = makeLightSeed(
  [
    { key: 'ilk',     name: 'İlk Görüşme',         duration_minutes: 60, price: 800, sort_order: 0 },
    { key: 'kontrol', name: 'Kontrol Görüşmesi',   duration_minutes: 30, price: 400, sort_order: 1 },
    { key: 'olcum',   name: 'Vücut Analizi',       duration_minutes: 30, price: 350, sort_order: 2 },
  ],
  ['Diyetisyen', 'Asistan'],
)

const TUTORING_SEED = makeLightSeed(
  [
    { key: 'matematik', name: 'Matematik',     duration_minutes: 60, price: 400, sort_order: 0 },
    { key: 'fen',       name: 'Fen Bilimleri', duration_minutes: 60, price: 400, sort_order: 1 },
    { key: 'ingilizce', name: 'İngilizce',     duration_minutes: 60, price: 400, sort_order: 2 },
    { key: 'tyt',       name: 'TYT/AYT',       duration_minutes: 90, price: 600, sort_order: 3 },
  ],
  ['Öğretmen', 'Asistan'],
)

const PHOTO_STUDIO_SEED = makeLightSeed(
  [
    { key: 'portre',   name: 'Portre Çekimi',      duration_minutes: 60, price: 1500, sort_order: 0 },
    { key: 'aile',     name: 'Aile Fotoğrafı',     duration_minutes: 90, price: 2500, sort_order: 1 },
    { key: 'urun',     name: 'Ürün Çekimi',        duration_minutes: 60, price: 1200, sort_order: 2 },
    { key: 'dis',      name: 'Dış Mekan Çekimi',   duration_minutes: 120, price: 3000, sort_order: 3 },
  ],
  ['Fotoğrafçı', 'Asistan'],
)

const CAR_WASH_SEED = makeLightSeed(
  [
    { key: 'dis_yikama', name: 'Dış Yıkama',        duration_minutes: 30,  price: 200,  sort_order: 0 },
    { key: 'ic_dis',     name: 'İç + Dış Yıkama',  duration_minutes: 60,  price: 400,  sort_order: 1 },
    { key: 'detay',      name: 'Detaylı Temizlik',  duration_minutes: 180, price: 1500, sort_order: 2 },
    { key: 'pasta',      name: 'Pasta + Cila',      duration_minutes: 240, price: 2500, sort_order: 3 },
  ],
  ['Operatör', 'Çırak'],
)

const AUTO_SERVICE_SEED = makeLightSeed(
  [
    { key: 'periyodik', name: 'Periyodik Bakım',  duration_minutes: 90, price: 1500, sort_order: 0 },
    { key: 'fren',      name: 'Fren Sistemi',     duration_minutes: 60, price: 1000, sort_order: 1 },
    { key: 'aku',       name: 'Akü Değişimi',     duration_minutes: 30, price: 300,  sort_order: 2 },
    { key: 'lastik',    name: 'Lastik Rotasyonu', duration_minutes: 30, price: 200,  sort_order: 3 },
  ],
  ['Usta', 'Çırak'],
)

const RESTAURANT_SEED = makeLightSeed(
  [
    { key: 'rezervasyon', name: 'Masa Rezervasyonu', duration_minutes: 90, price: 0, sort_order: 0 },
    { key: 'ozel',         name: 'Özel Etkinlik',    duration_minutes: 180, price: 0, sort_order: 1 },
  ],
  ['Şef', 'Garson', 'Komi'],
)

const CAFE_SEED = makeLightSeed(
  [
    { key: 'rezervasyon', name: 'Masa Rezervasyonu', duration_minutes: 60, price: 0, sort_order: 0 },
  ],
  ['Barista', 'Garson'],
)

const LAWYER_SEED = makeLightSeed(
  [
    { key: 'gorus',  name: 'İlk Görüşme',         duration_minutes: 60, price: 1500, sort_order: 0 },
    { key: 'dosya',  name: 'Dosya İncelemesi',    duration_minutes: 90, price: 2500, sort_order: 1 },
  ],
  ['Avukat', 'Stajyer Avukat', 'Sekreter'],
)

export const SECTOR_SEEDS: Partial<Record<SectorType, SectorSeed>> = {
  dental_clinic: DENTAL_CLINIC_SEED,
  medical_aesthetic: MEDICAL_AESTHETIC_SEED,
  hair_salon: HAIR_SALON_SEED,
  barber: BARBER_SEED,
  beauty_salon: BEAUTY_SALON_SEED,
  physiotherapy: PHYSIOTHERAPY_SEED,
  veterinary: VETERINARY_SEED,
  psychologist: PSYCHOLOGIST_SEED,
  spa_massage: SPA_MASSAGE_SEED,
  fitness: FITNESS_SEED,
  yoga_pilates: YOGA_PILATES_SEED,
  tattoo_piercing: TATTOO_PIERCING_SEED,
  dietitian: DIETITIAN_SEED,
  tutoring: TUTORING_SEED,
  photo_studio: PHOTO_STUDIO_SEED,
  car_wash: CAR_WASH_SEED,
  auto_service: AUTO_SERVICE_SEED,
  restaurant: RESTAURANT_SEED,
  cafe: CAFE_SEED,
  lawyer: LAWYER_SEED,
}

export function getSeedForSector(sector: SectorType): SectorSeed | null {
  return SECTOR_SEEDS[sector] ?? null
}

/**
 * Sektöre göre personel etiket havuzu önerisi.
 * Sektörde seed yoksa veya etiket tanımlı değilse fallback olarak ['Personel'] döner.
 */
export function getStaffTagsForSector(sector: SectorType): string[] {
  return SECTOR_SEEDS[sector]?.staff_tags ?? ['Personel']
}
