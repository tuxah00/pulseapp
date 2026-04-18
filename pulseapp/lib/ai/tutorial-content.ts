import type { SectorType } from '@/types'

export interface TutorialTopic {
  pageKey: string
  path: string
  title: string
  skeleton: string
  primaryAction?: string
  sectorSpecific?: SectorType[]
}

/**
 * Her personelin mutlaka görmesi gereken çekirdek sayfalar.
 * Sektör fark etmeksizin tüm kullanıcılarda çalışır.
 */
export const CORE_TUTORIAL_TOPICS: TutorialTopic[] = [
  // --- Ana akış ---
  {
    pageKey: 'dashboard',
    path: '/dashboard',
    title: 'Genel Bakış',
    skeleton:
      'Bugünkü randevular, bekleyen işler ve müşteri segmenti özeti burada. Günün akışını hızlıca görmek için bu sayfayla başla.',
  },
  {
    pageKey: 'appointments',
    path: '/dashboard/appointments',
    title: 'Randevular',
    skeleton:
      'Randevuları liste, kutu, haftalık ve aylık görünümde yönet. Sağ üstteki "Yeni Randevu" ile ekle; haftalık/aylık görünümde sürükle-bırak ile zamanı değiştir.',
    primaryAction: 'Yeni Randevu butonu',
  },
  {
    pageKey: 'customers',
    path: '/dashboard/customers',
    title: 'Müşteriler',
    skeleton:
      'Müşteri kartına tıklayınca Bilgiler ve Geçmiş sekmeleri açılır. Yeni randevu oluşturmadan önce müşteri kaydı gereklidir.',
  },
  {
    pageKey: 'waitlist',
    path: '/dashboard/waitlist',
    title: 'Bekleme Listesi',
    skeleton:
      'Dolu saatlerde yer talep eden müşterileri buraya ekle; boşluk oluştuğunda ilk uygun kişiye bildirim gönderirsin. Sağ üstten yeni kayıt ekle.',
  },
  {
    pageKey: 'services',
    path: '/dashboard/services',
    title: 'Hizmetler',
    skeleton:
      'Sunduğun hizmetleri, sürelerini ve fiyatlarını buradan yönet. Randevular bu listeyi baz alır; fiyat değişirse yeni randevulara yansır.',
  },
  {
    pageKey: 'messages',
    path: '/dashboard/messages',
    title: 'Mesajlar',
    skeleton:
      'Müşteri SMS ve WhatsApp yazışmaları burada toplanır. AI asistan yanıt önerisi sunar, onay verdiğinde gönderir.',
  },
  {
    pageKey: 'staff',
    path: '/dashboard/staff',
    title: 'Personeller',
    skeleton:
      'Personel ekle, rol ata ve yetki yönet. Yeni personel davet linkiyle katılır; modül bazlı izinler detay panelinden ayarlanır.',
  },

  // --- Finans ---
  {
    pageKey: 'pos',
    path: '/dashboard/pos',
    title: 'Kasa',
    skeleton:
      'Anlık satış, tahsilat ve günlük kasa açılış-kapanışını buradan yönet. Yapılan satışlar otomatik fatura oluşturur.',
  },
  {
    pageKey: 'analytics',
    path: '/dashboard/analytics',
    title: 'Gelir-Gider',
    skeleton:
      'Randevu geliri, fatura, manuel gelir ve giderlerini tek tabloda gör; kâr-zarar ve trend grafiğini buradan izle. Sağ üstten gider veya manuel gelir ekle.',
  },
  {
    pageKey: 'invoices',
    path: '/dashboard/invoices',
    title: 'Faturalar',
    skeleton:
      'Müşteri faturalarını oluştur, tahsilat al ve taksit/kapora yönet. Ödeme geçmişi fatura detayında saklanır; ürün kalemleri stoktan otomatik düşer.',
  },
  {
    pageKey: 'commissions',
    path: '/dashboard/commissions',
    title: 'Prim & Komisyon',
    skeleton:
      'Personel bazlı prim/komisyon kazançlarını hesapla ve geçmiş ödemeleri takip et. Politikaları Ayarlar → Prim Politikaları üzerinden tanımlarsın.',
  },

  // --- İletişim & pazarlama ---
  {
    pageKey: 'campaigns',
    path: '/dashboard/campaigns',
    title: 'Kampanyalar',
    skeleton:
      'SMS/WhatsApp kampanyalarını segmentlere göre oluştur, kitleyi tahmin et ve gönder. Yeni kampanya butonundan başla; istatistikler gönderim sonrası dolar.',
  },
  {
    pageKey: 'workflows',
    path: '/dashboard/workflows',
    title: 'Otomatik Mesajlar',
    skeleton:
      'Belirli olaylar (yeni müşteri, randevu sonrası vb.) gerçekleşince otomatik SMS gönder. Aç/kapa ve içeriği düzenle.',
  },
  {
    pageKey: 'notifications',
    path: '/dashboard/notifications',
    title: 'Bildirimler',
    skeleton:
      'Yeni randevu, ödeme, müşteri mesajı gibi sistem bildirimlerinin tamamı burada listelenir. Okundu olarak işaretleyebilir veya filtreleyebilirsin.',
  },

  // --- Operasyon ---
  {
    pageKey: 'shifts',
    path: '/dashboard/shifts',
    title: 'Vardiya',
    skeleton:
      'Personel haftalık vardiya tablosunu buradan yönet. Tek tek atama veya "Otomatik Dağıt" ile tanımlı mesaileri dağıt; görseli indirip paylaşabilirsin.',
  },

  // --- Güvenlik / uyum ---
  {
    pageKey: 'audit',
    path: '/dashboard/audit',
    title: 'Denetim Kaydı',
    skeleton:
      'Personel aksiyonlarının (ekleme, güncelleme, silme) tam kaydı burada. Yalnızca işletme sahibi görebilir; şüpheli durumda filtrele.',
  },
  {
    pageKey: 'kvkk',
    path: '/dashboard/kvkk',
    title: 'KVKK',
    skeleton:
      'Müşteri aydınlatma/onay kayıtlarını ve veri silme taleplerini buradan yönet. Her müşteri için onay durumu ve tarihi saklanır.',
  },

  // --- İş zekası & AI ---
  {
    pageKey: 'insights',
    path: '/dashboard/insights',
    title: 'İş Zekası',
    skeleton:
      'Müşteri segmentleri, mevsimsel trendler, kohort analizi ve AI önerilerini buradan izle. Satranç tahtası grafiği hangi müşteri grubunun büyüdüğünü gösterir.',
  },
  {
    pageKey: 'assistant-actions',
    path: '/dashboard/assistant-actions',
    title: 'Asistan Aksiyonları',
    skeleton:
      'Asistanın önerdiği randevu, kampanya ve müşteri aksiyonlarını buradan onayla veya reddet. Onaylanan öneriler otomatik olarak uygulanır.',
  },
  {
    pageKey: 'rewards',
    path: '/dashboard/rewards',
    title: 'Ödüller',
    skeleton:
      'Müşterilere verilebilecek ödül şablonlarını (indirim, ücretsiz hizmet, puan) buradan tanımla. Referans sistemi ve kampanyalarla birlikte çalışır.',
  },

  // --- Ayarlar ---
  {
    pageKey: 'settings',
    path: '/dashboard/settings',
    title: 'Ayarlar',
    skeleton:
      'İşletme bilgileri, AI tercihleri, hizmetler, personel yetkileri, mesai tanımları, abonelik ve prim politikaları bu hub üzerinden açılır.',
  },
  {
    pageKey: 'settings_ai',
    path: '/dashboard/settings/ai',
    title: 'AI Tercihleri',
    skeleton:
      'Asistanın ton (samimi/formal/kısa) tercihlerini, günlük brief saatini, varsayılan hatırlatma süresini ve özel talimatlarını buradan ayarla. Başlangıç ipuçlarını da buradan aç/kapat.',
  },
  {
    pageKey: 'settings_business',
    path: '/dashboard/settings/business',
    title: 'İşletme Bilgileri',
    skeleton:
      'İşletme adı, telefon, adres, çalışma saatleri ve sektör bilgisini buradan güncelle. Çalışma saatleri randevu formu ve müşteri booking sayfasını doğrudan etkiler.',
  },
  {
    pageKey: 'settings_services',
    path: '/dashboard/settings/services',
    title: 'Hizmet Ayarları',
    skeleton:
      'Hizmet kategorileri, varsayılan süreler ve fiyat politikalarını buradan yönet. Tekil hizmet ekleme/düzenleme Hizmetler sayfasından yapılır.',
  },
  {
    pageKey: 'settings_staff',
    path: '/dashboard/settings/staff',
    title: 'Personel Yetkileri',
    skeleton:
      'Her personelin modül bazlı yetkilerini (randevu, müşteri, fatura…) ince ayar yap. Değişiklikler anında uygulanır; yanlışlık olursa "Rol Varsayılanına Dön" ile sıfırla.',
  },
  {
    pageKey: 'settings_shifts',
    path: '/dashboard/settings/shifts',
    title: 'Vardiya Tanımları',
    skeleton:
      'Sabahçı/Öğlenci gibi standart mesai kalıplarını burada tanımla. Tanımlı mesaileri Vardiya sayfasında "Otomatik Dağıt" veya hızlı seçim ile kullanırsın.',
  },
  {
    pageKey: 'settings_billing',
    path: '/dashboard/settings/billing',
    title: 'Abonelik & Ödeme',
    skeleton:
      'Mevcut plan (Starter/Standard/Pro), ödeme geçmişi ve plan yükseltme seçenekleri burada. PayTR ile kredi kartı ödemesi yapılır.',
  },
  {
    pageKey: 'settings_commissions',
    path: '/dashboard/settings/commissions',
    title: 'Prim Politikaları',
    skeleton:
      'Personel başına veya hizmet başına prim oranları burada tanımlanır. Politika tanımlandıktan sonra kazançlar Prim & Komisyon sayfasında otomatik hesaplanır.',
  },
  {
    pageKey: 'settings_audit',
    path: '/dashboard/settings/audit',
    title: 'Denetim Ayarları',
    skeleton:
      'Hangi aksiyonların denetim kaydına yazılacağını ve saklama süresini buradan ayarla. Kayıtları görmek için Denetim sayfasını kullan.',
  },
]

/**
 * Sektöre özel ek topic'ler — yalnızca ilgili sektörde gösterilir.
 * Sidebar'da zaten görünmeyen sayfalar listede olmamalı.
 */
export const SECTOR_TUTORIAL_TOPICS: Partial<Record<SectorType, TutorialTopic[]>> = {
  // --- Saç/Güzellik ---
  hair_salon: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Birden çok hizmeti tek pakette sat (örn. 5 saç bakım seansı). Müşteriye atanan paket randevu oluşturuldukça otomatik düşer.',
    },
    {
      pageKey: 'inventory',
      path: '/dashboard/inventory',
      title: 'Stoklar',
      skeleton:
        'Şampuan, boya, fön malzemeleri gibi ürünleri burada takip et. Faturaya ürün eklendiğinde stok otomatik azalır; kritik seviye uyarısı alırsın.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri geri bildirimlerini ve puanları burada gör. Olumsuz yorumlara hızlı yanıt vermek müşteri sadakatini artırır.',
    },
  ],
  barber: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Sakal-traş-bakım kombinasyonlarını paket olarak sun. Müşteriye atanan paket seans sayısınca düşer.',
    },
    {
      pageKey: 'inventory',
      path: '/dashboard/inventory',
      title: 'Stoklar',
      skeleton:
        'Ürün satış ve sarf malzemesi stoklarını burada yönet. Faturaya ürün eklendiğinde stok otomatik düşer.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları burada toplanır. Yüksek puanları sosyal medyada paylaşmak için kolay kopyala.',
    },
  ],
  beauty_salon: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Bakım paketlerini (cilt bakımı, tırnak bakımı serisi) burada tanımla. Satış sonrası müşteriye atanan paket seanslarla düşer.',
    },
    {
      pageKey: 'inventory',
      path: '/dashboard/inventory',
      title: 'Stoklar',
      skeleton:
        'Cilt bakım ürünleri, oje ve sarf malzemesi stoklarını buradan takip et. Faturaya ürün eklendiğinde stok otomatik azalır.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumlarını buradan yönet. Olumsuz yoruma hızlı yanıt, itibar yönetiminin temelidir.',
    },
  ],

  // --- Klinik ---
  dental_clinic: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Hasta Dosyaları',
      skeleton:
        'Her hastanın reçetesi, röntgeni, diş haritası ve tedavi geçmişi burada tutulur. Müşteri oluşturulduktan sonra dosya açılıp randevularla ilişkilendirilir.',
    },
    {
      pageKey: 'protocols',
      path: '/dashboard/protocols',
      title: 'Tedavi Protokolleri',
      skeleton:
        'Seansa yayılan tedavileri (implant, ortodonti, kanal) adım adım takip et. Seans sayısı ve aralığı planlanır, her seans bir randevuya bağlanır.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Beyazlatma, hijyen, kontrol gibi paketli hizmetleri burada tanımla. Seansla ödeme takibi kolaylaşır.',
    },
    {
      pageKey: 'follow-ups',
      path: '/dashboard/follow-ups',
      title: 'Takipler',
      skeleton:
        'Tedavi sonrası kontrol takip kuyruğu burada. Planlanmış takipler tarihi gelince hatırlatma SMS\'i olarak gönderilir.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Hasta geri bildirimlerini ve puanları buradan yönet. Tedavi bitişi sonrası yorum isteği otomatik gönderilebilir.',
    },
  ],
  medical_aesthetic: [
    {
      pageKey: 'protocols',
      path: '/dashboard/protocols',
      title: 'Tedavi Protokolleri',
      skeleton:
        'Seanslı işlemleri (botoks tazeleme, lazer, mezoterapi kürleri) planla ve takip et. Her seans otomatik hatırlatmaya bağlanır.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Çok seanslı estetik paketlerini burada sat. Müşteriye atanan paket kullanıldıkça düşer.',
    },
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Hasta Dosyaları',
      skeleton:
        'Hastanın alerjileri, öncesi/sonrası fotoğrafları ve işlem geçmişi burada. Yeni işlem öncesi kontrendikasyon kontrolü için dosyayı güncel tut.',
    },
    {
      pageKey: 'follow-ups',
      path: '/dashboard/follow-ups',
      title: 'Takipler',
      skeleton:
        'İşlem sonrası takip aramaları/mesajları kuyruğu burada. Tatmin, yan etki ve sonraki randevu planı için kritik.',
    },
    {
      pageKey: 'referrals',
      path: '/dashboard/referrals',
      title: 'Referanslar',
      skeleton:
        'Müşteri tavsiye sistemi — yeni hasta getiren müşteriye ödül tanımla ve dönüşümü takip et.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Hasta yorumları ve puanları burada. Tedavi sonrası otomatik yorum isteği sistem tarafından gönderilebilir.',
    },
  ],
  physiotherapy: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Hasta Dosyaları',
      skeleton:
        'Her hastanın tanı, ağrı haritası ve seans notları burada. Egzersiz programı ve ilerleme buradan takip edilir.',
    },
    {
      pageKey: 'protocols',
      path: '/dashboard/protocols',
      title: 'Tedavi Protokolleri',
      skeleton:
        'Seanslı fizik tedavi programlarını planla. Seans sayısı, aralık ve hedef kazanımlar burada tanımlanır.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Seanslı tedavi paketlerini burada sat. Seans kullanıldıkça otomatik düşer.',
    },
    {
      pageKey: 'follow-ups',
      path: '/dashboard/follow-ups',
      title: 'Takipler',
      skeleton:
        'Seanslar arası kontrol ve devam takibi kuyruğu burada.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Hasta memnuniyet puanları ve yorumları burada.',
    },
  ],

  // --- Danışmanlık ---
  psychologist: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Danışan Dosyaları',
      skeleton:
        'Seans notları, değerlendirme ölçekleri ve tedavi planları burada. Gizlilik nedeniyle yalnızca yetkili personel görür.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Seans paketlerini burada tanımla (ör. 10 seanslık terapi paketi).',
    },
    {
      pageKey: 'follow-ups',
      path: '/dashboard/follow-ups',
      title: 'Takipler',
      skeleton:
        'Seanslar arası kontrol ve devam takibi kuyruğu.',
    },
  ],
  lawyer: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Müvekkil Dosyaları',
      skeleton:
        'Dava bilgisi, belgeler ve görüşme notları burada. Dosyalar tarihçe sırasıyla tutulur.',
    },
  ],
  dietitian: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Diyet Programları',
      skeleton:
        'Danışanın ölçümleri, hedefleri ve haftalık diyet listeleri burada. İlerleme grafiği müşteri panelinden izlenir.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Kilo yönetimi paketlerini (aylık/üç aylık) buradan sat.',
    },
    {
      pageKey: 'follow-ups',
      path: '/dashboard/follow-ups',
      title: 'Takipler',
      skeleton:
        'Haftalık kontrol ve ölçüm takibi kuyruğu burada.',
    },
  ],
  tutoring: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Öğrenci Bilgileri',
      skeleton:
        'Her öğrencinin ders programı, sınav sonuçları ve veli bilgisi burada. Derslere göre gelişim takip edilir.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Ders paketlerini (aylık, dönemlik) buradan sat. Kalan ders sayısı otomatik düşer.',
    },
  ],

  // --- Veteriner ---
  veterinary: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Hasta Dosyaları',
      skeleton:
        'Her hayvanın aşı kartı, muayene notları ve ilaç geçmişi burada. Sahip bilgisi müşteri kartında tutulur.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Aşı takvimi, kontrol paketleri gibi hizmet kombinasyonlarını burada tanımla.',
    },
    {
      pageKey: 'follow-ups',
      path: '/dashboard/follow-ups',
      title: 'Takipler',
      skeleton:
        'Aşı hatırlatma ve kontrol takibi kuyruğu burada. Tarih gelince otomatik SMS gider.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],

  // --- Oto ---
  auto_service: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Periyodik bakım paketlerini burada tanımla. Hizmet aralıkları otomatik hatırlatma oluşturur.',
    },
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Araç Kayıtları',
      skeleton:
        'Her aracın plaka, km, geçmiş işlem ve parça bilgisi burada. Sahip müşteri kartına bağlanır.',
    },
    {
      pageKey: 'inventory',
      path: '/dashboard/inventory',
      title: 'Stoklar',
      skeleton:
        'Yedek parça ve yağ stoklarını burada yönet. Faturaya parça eklendiğinde stok otomatik düşer.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],
  car_wash: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Aylık yıkama paketleri ve abonelikleri burada tanımla.',
    },
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Araç Kayıtları',
      skeleton:
        'Plaka, araç tipi ve geçmiş yıkama kayıtları burada.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],

  // --- Fitness / wellness ---
  fitness: [
    {
      pageKey: 'memberships',
      path: '/dashboard/memberships',
      title: 'Üyelikler',
      skeleton:
        'Aylık/yıllık üyelik paketlerini tanımla ve üye durumlarını takip et. Süresi yaklaşan üyelere hatırlatma gönderilir.',
    },
    {
      pageKey: 'classes',
      path: '/dashboard/classes',
      title: 'Sınıf Programı',
      skeleton:
        'Grup dersleri programını yönet. Kapasite, eğitmen ve katılımcı listesi buradan izlenir.',
    },
    {
      pageKey: 'classes_attendance',
      path: '/dashboard/classes/attendance',
      title: 'Devam Takibi',
      skeleton:
        'Derslere katılımı tek tıkla işaretle. Üye derse girdikçe paket/üyelik hakkı otomatik düşer.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'PT seansı ve özel ders paketlerini burada sat.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Üye yorumları ve puanları burada.',
    },
  ],
  yoga_pilates: [
    {
      pageKey: 'classes',
      path: '/dashboard/classes',
      title: 'Sınıf Programı',
      skeleton:
        'Grup dersleri programını yönet. Kapasite, eğitmen ve katılımcı listesi buradan izlenir.',
    },
    {
      pageKey: 'memberships',
      path: '/dashboard/memberships',
      title: 'Üyelikler',
      skeleton:
        'Paket ve üyelik planlarını yönet. Kalan ders hakkı üye panelinde otomatik güncellenir.',
    },
    {
      pageKey: 'classes_attendance',
      path: '/dashboard/classes/attendance',
      title: 'Devam Takibi',
      skeleton:
        'Derslere katılımı tek tıkla işaretle. Üye derse girdikçe kalan ders hakkı otomatik düşer.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Özel ders ve etkinlik paketlerini burada tanımla.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Üye yorumları ve puanları burada.',
    },
  ],
  spa_massage: [
    {
      pageKey: 'memberships',
      path: '/dashboard/memberships',
      title: 'Üyelikler',
      skeleton:
        'Aylık spa üyelikleri ve masaj paketlerini burada tanımla.',
    },
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Çok seanslı masaj ve bakım paketlerini buradan sat.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],

  // --- Yaratıcı / sanat ---
  photo_studio: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Düğün, bebek, aile çekimi gibi paketleri burada tanımla.',
    },
    {
      pageKey: 'portfolio',
      path: '/dashboard/portfolio',
      title: 'Çalışma Galerisi',
      skeleton:
        'Çekim örneklerini kategoriler halinde yükle. Müşteri booking sayfasında galeri otomatik gösterilir.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],
  tattoo_piercing: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Büyük tasarımlar için seanslı paketleri burada tanımla.',
    },
    {
      pageKey: 'portfolio',
      path: '/dashboard/portfolio',
      title: 'Çalışma Galerisi',
      skeleton:
        'Yapılan dövme/piercing örneklerini yükle. Müşteri booking sayfasında sanatçı başına galeri gösterilir.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],

  // --- Yeme-içme ---
  restaurant: [
    {
      pageKey: 'reservations',
      path: '/dashboard/reservations',
      title: 'Rezervasyonlar',
      skeleton:
        'Masa rezervasyonlarını yönet. Gelen talepleri onayla, masa ve saat ataması buradan yapılır.',
    },
    {
      pageKey: 'orders',
      path: '/dashboard/orders',
      title: 'Siparişler',
      skeleton:
        'Aktif siparişleri takip et. Yeni sipariş ekleme, masa bazlı adisyon ve ödeme akışı buradan yönetilir.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],
  cafe: [
    {
      pageKey: 'reservations',
      path: '/dashboard/reservations',
      title: 'Rezervasyonlar',
      skeleton:
        'Masa rezervasyonlarını yönet. Gelen talepleri onayla, masa ve saat ataması buradan yapılır.',
    },
    {
      pageKey: 'orders',
      path: '/dashboard/orders',
      title: 'Siparişler',
      skeleton:
        'Aktif siparişleri takip et. Yeni sipariş ekleme, masa bazlı adisyon ve ödeme akışı buradan yönetilir.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],

  // --- Genel ---
  other: [
    {
      pageKey: 'packages',
      path: '/dashboard/packages',
      title: 'Paket & Seans',
      skeleton:
        'Çok seanslı hizmet paketlerini burada tanımla.',
    },
    {
      pageKey: 'inventory',
      path: '/dashboard/inventory',
      title: 'Stoklar',
      skeleton:
        'Ürün ve sarf malzemesi stoklarını buradan takip et.',
    },
    {
      pageKey: 'reviews',
      path: '/dashboard/reviews',
      title: 'Yorumlar',
      skeleton:
        'Müşteri yorumları ve puanları burada.',
    },
  ],
}

export function getTutorialTopicsForSector(sector: SectorType): TutorialTopic[] {
  return [...CORE_TUTORIAL_TOPICS, ...(SECTOR_TUTORIAL_TOPICS[sector] ?? [])]
}

/**
 * Bilinmeyen sayfalar için kullanılacak jenerik tutorial topic.
 * Asistan yine de sayfayı yorumlayabilir — başlık pathname'den üretilir.
 */
function buildGenericTopic(path: string): TutorialTopic {
  const clean = path.split('?')[0].split('#')[0]
  const last = clean.replace(/\/$/, '').split('/').filter(Boolean).pop() || 'dashboard'
  const title = last
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
  return {
    pageKey: `generic:${clean}`,
    path: clean,
    title,
    skeleton:
      'Bu sayfa hakkında kısa bir açıklama ister misin? Asistan sayfanın ana amacını ve öne çıkan butonları özetler.',
  }
}

export function findTopicByPath(path: string, sector: SectorType): TutorialTopic | null {
  // Query string'leri at, yalnızca pathname eşleştir
  const clean = path.split('?')[0].split('#')[0]
  // Dashboard dışı (auth, booking, public) sayfalarda ipucu gösterme
  if (!clean.startsWith('/dashboard')) return null
  const match = getTutorialTopicsForSector(sector).find(t => t.path === clean)
  if (match) return match
  return buildGenericTopic(clean)
}

export function findTopicByKey(pageKey: string, sector: SectorType): TutorialTopic | null {
  return getTutorialTopicsForSector(sector).find(t => t.pageKey === pageKey) ?? null
}
