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
      'Randevuları liste, kutu, haftalık ve aylık görünümde yönet. Sağ üstteki "Yeni Randevu" ile ekle, haftalık/aylık görünümde sürükle-bırak ile zamanı değiştir.',
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
    pageKey: 'services',
    path: '/dashboard/services',
    title: 'Hizmetler',
    skeleton:
      'Sunduğun hizmetleri, sürelerini ve fiyatlarını buradan yönet. Randevular bu listedeki hizmetleri baz alır, fiyat değişirse yeni randevulara yansır.',
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
      'Personel ekle, rol ata ve yetki yönet. Yeni personel davet linkiyle katılır, modül bazlı izinleri detay panelinden ayarlanır.',
  },
]

/**
 * Sektöre özel ek topic'ler — yalnızca ilgili sektörde gösterilir.
 * Sidebar'da zaten görünmeyen sayfalar listede olmamalı.
 */
export const SECTOR_TUTORIAL_TOPICS: Partial<Record<SectorType, TutorialTopic[]>> = {
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
  ],
  medical_aesthetic: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Hasta Dosyaları',
      skeleton:
        'Hastanın alerjileri, öncesi/sonrası fotoğrafları ve işlem geçmişi burada. Yeni işlem öncesi kontrendikasyon kontrolü için dosyayı güncel tut.',
    },
    {
      pageKey: 'protocols',
      path: '/dashboard/protocols',
      title: 'Tedavi Protokolleri',
      skeleton:
        'Seanslı işlemleri (botoks tazeleme, lazer, mezoterapi kürleri) planla ve takip et. Her seans otomatik hatırlatmaya bağlanır.',
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
  ],
  veterinary: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Hasta Dosyaları',
      skeleton:
        'Her hayvanın aşı kartı, muayene notları ve ilaç geçmişi burada. Sahip bilgisi müşteri kartında tutulur.',
    },
  ],
  psychologist: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Danışan Dosyaları',
      skeleton:
        'Seans notları, değerlendirme ölçekleri ve tedavi planları burada. Gizlilik nedeniyle yalnızca yetkili personel görür.',
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
  ],
  tutoring: [
    {
      pageKey: 'records',
      path: '/dashboard/records',
      title: 'Öğrenci Bilgileri',
      skeleton:
        'Her öğrencinin ders programı, sınav sonuçları ve veli bilgisi burada. Derslere göre gelişim takip edilir.',
    },
  ],
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
  ],
  fitness: [
    {
      pageKey: 'memberships',
      path: '/dashboard/memberships',
      title: 'Üyelikler',
      skeleton:
        'Aylık/yıllık üyelik paketlerini tanımla ve üye durumlarını takip et. Süresi yaklaşan üyelere hatırlatma gönderilir.',
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
  ],
}

export function getTutorialTopicsForSector(sector: SectorType): TutorialTopic[] {
  return [...CORE_TUTORIAL_TOPICS, ...(SECTOR_TUTORIAL_TOPICS[sector] ?? [])]
}

export function findTopicByPath(path: string, sector: SectorType): TutorialTopic | null {
  return getTutorialTopicsForSector(sector).find(t => t.path === path) ?? null
}

export function findTopicByKey(pageKey: string, sector: SectorType): TutorialTopic | null {
  return getTutorialTopicsForSector(sector).find(t => t.pageKey === pageKey) ?? null
}
