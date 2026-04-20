/**
 * Dashboard tarafında sektöre göre değişen başlık ve etiketler.
 * Portal için benzer eşlemeler `lib/portal/sector-labels.ts` içinde yer alır.
 *
 * Amaç: "Protokol", "Kontrendikasyon", "Paket", "Kayıt" gibi medikal/estetik
 * terimleri, sektöre uygun daha anlaşılır Türkçe karşılıklarına dönüştürmek.
 */

import type { SectorType } from '@/types'

type SectorKey = SectorType | string | null | undefined

/** Medikal / klinik sektörler — tedavi-protokol terminolojisi uygun. */
const MEDICAL_SECTORS = new Set<string>([
  'dental_clinic',
  'medical_aesthetic',
  'physiotherapy',
  'veterinary',
  'dietitian',
  'psychologist',
])

/** Güzellik / bakım sektörleri — "Tedavi" yerine "Hizmet Paketi" / "Bakım". */
const BEAUTY_SECTORS = new Set<string>([
  'hair_salon',
  'barber',
  'spa',
  'beauty_salon',
  'nail_salon',
  'tattoo',
])

export function isMedicalSector(sector: SectorKey): boolean {
  return !!sector && MEDICAL_SECTORS.has(sector as string)
}

export function isBeautySector(sector: SectorKey): boolean {
  return !!sector && BEAUTY_SECTORS.has(sector as string)
}

/**
 * "Protokoller" → sektöre göre:
 * - medikal: "Tedavi Protokolleri"
 * - güzellik: "Hizmet Paketleri"
 * - diğer: null (sidebar'dan gizle)
 */
export function getProtocolsLabel(sector: SectorKey): string | null {
  if (isMedicalSector(sector)) return 'Tedavi Protokolleri'
  if (isBeautySector(sector)) return 'Hizmet Paketleri'
  return null
}

/**
 * Protokoller sayfasında gösterilebilir mi?
 * (null dönerse sidebar'dan gizlenmeli.)
 */
export function shouldShowProtocols(sector: SectorKey): boolean {
  return getProtocolsLabel(sector) !== null
}

/**
 * "Kayıtlar" → sektöre göre kişiselleştirilmiş başlık.
 */
export function getRecordsLabel(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
    case 'medical_aesthetic':
    case 'physiotherapy':
      return 'Hasta Kayıtları'
    case 'veterinary':
      return 'Pati Dosyaları'
    case 'psychologist':
      return 'Seans Notları'
    case 'dietitian':
      return 'Beslenme Takipleri'
    case 'hair_salon':
    case 'barber':
      return 'Müşteri Notları'
    case 'spa':
    case 'beauty_salon':
    case 'nail_salon':
    case 'tattoo':
      return 'Müşteri Dosyaları'
    default:
      return 'Müşteri Dosyaları'
  }
}

/**
 * Kontrendikasyon alanı → sektöre göre etiket.
 * Medikal olmayan sektörlerde "Dikkat Edilecekler" kullanılır.
 */
export function getContraindicationLabel(sector: SectorKey): string {
  if (isMedicalSector(sector)) return 'Kontrendikasyon'
  return 'Dikkat Edilecekler'
}

/**
 * Paket terimi → sektöre göre etiket.
 */
export function getPackagesLabel(sector: SectorKey): string {
  if (isMedicalSector(sector)) return 'Tedavi Paketleri'
  if (isBeautySector(sector)) return 'Hizmet Paketleri'
  return 'Paketler'
}

/**
 * Portföy / galeri → sektöre göre etiket.
 */
export function getPortfolioLabel(sector: SectorKey): string {
  if (isMedicalSector(sector)) return 'Öncesi / Sonrası'
  return 'Çalışma Galerisi'
}

/**
 * Müşteri notu alanı için sektöre özgü placeholder.
 * Kuaförde "saç tipi", diş klinikte "alerji/tedavi geçmişi" gibi örnek metinler üretir.
 */
export function getCustomerNotesPlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
      return 'Diş hassasiyeti, alerji, önceki tedaviler...'
    case 'medical_aesthetic':
      return 'Cilt tipi, alerjiler, beklentiler...'
    case 'physiotherapy':
      return 'Şikayet, sakatlık geçmişi, notlar...'
    case 'veterinary':
      return 'Irk, yaş, aşılar, tıbbi geçmiş...'
    case 'dietitian':
      return 'Hedef kilo, alerji, kısıtlamalar...'
    case 'psychologist':
      return 'Başvuru nedeni, seans notları...'
    case 'lawyer':
      return 'Dava tipi, dosya notları...'
    case 'hair_salon':
    case 'barber':
      return 'Saç tipi, tercih edilen kesim, alerji...'
    case 'beauty_salon':
    case 'nail_salon':
    case 'spa':
      return 'Cilt hassasiyeti, tercihler, alerjiler...'
    case 'fitness':
    case 'yoga_pilates':
      return 'Hedefler, sakatlık geçmişi, seviye...'
    case 'tutoring':
      return 'Sınıf, hedef sınav, odak konular...'
    case 'tattoo':
      return 'Tasarım tercihi, alerji, önceki dövmeler...'
    default:
      return 'Tercihler, alerjiler, notlar...'
  }
}

/**
 * Randevu notu alanı için sektöre özgü placeholder.
 */
export function getAppointmentNotesPlaceholder(sector: SectorKey): string {
  if (isMedicalSector(sector)) return 'Şikayet, talep, özel durum...'
  if (isBeautySector(sector)) return 'İstek, tercih edilen model, not...'
  switch (sector) {
    case 'fitness':
    case 'yoga_pilates':
      return 'Hedef, odak bölge, not...'
    case 'tutoring':
      return 'Konu, ödev, özel istek...'
    case 'psychologist':
      return 'Seans odağı, talep...'
    default:
      return 'Ek bilgi, talep...'
  }
}

/**
 * Hizmet adı alanı için sektöre özgü örnek.
 * Eski sabit "Saç Kesimi" yerine sektöre uygun örnek.
 */
export function getServiceNamePlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'hair_salon': return 'Saç Kesimi'
    case 'barber': return 'Sakal Tıraşı'
    case 'dental_clinic': return 'Diş Muayenesi'
    case 'medical_aesthetic': return 'Cilt Bakımı'
    case 'veterinary': return 'Muayene'
    case 'physiotherapy': return 'Seans'
    case 'beauty_salon': return 'Manikür'
    case 'nail_salon': return 'Kalıcı Oje'
    case 'spa': return 'Klasik Masaj'
    case 'tattoo': return 'Dövme'
    case 'psychologist': return 'Bireysel Seans'
    case 'lawyer': return 'Danışmanlık'
    case 'fitness': return 'PT Seansı'
    case 'yoga_pilates': return 'Reformer Seansı'
    case 'dietitian': return 'Beslenme Görüşmesi'
    case 'tutoring': return 'Ders'
    default: return 'Hizmet Adı'
  }
}

/**
 * Hizmet açıklaması alanı için sektöre özgü örnek.
 * Eski sabit "Yıkama dahil" yerine sektöre uygun örnek.
 */
export function getServiceDescriptionPlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'hair_salon': return 'Yıkama dahil'
    case 'barber': return 'Sakal düzeltme dahil'
    case 'dental_clinic': return 'Detaylı muayene + röntgen'
    case 'medical_aesthetic': return '20 dk seans + ürün dahil'
    case 'veterinary': return 'Genel muayene + aşı kontrolü'
    case 'physiotherapy': return '45 dk seans + ev programı'
    case 'beauty_salon':
    case 'nail_salon': return 'Cilt analizi dahil'
    case 'spa': return '50 dk masaj, yağlar dahil'
    case 'psychologist': return '45 dk seans'
    case 'fitness':
    case 'yoga_pilates': return '60 dk seans'
    default: return 'Kısa açıklama'
  }
}

/**
 * Kayıt / dosya açıklaması için sektöre özgü placeholder.
 */
export function getRecordDescriptionPlaceholder(sector: SectorKey): string {
  if (isMedicalSector(sector)) return 'Dosya içeriği, tarih, ilgili tedavi...'
  return 'Dosya açıklaması...'
}

/**
 * Teşhis alanı için sektöre özgü placeholder (Hasta Dosyaları).
 */
export function getDiagnosisPlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
      return 'Örn: Diş çürüğü, kanal tedavisi gerekli'
    case 'medical_aesthetic':
      return 'Örn: Cilt sarkması, pigmentasyon, yaşlanma'
    case 'physiotherapy':
      return 'Örn: Bel fıtığı, boyun ağrısı, omuz sertliği'
    case 'veterinary':
      return 'Örn: Otitis, göz enfeksiyonu'
    case 'psychologist':
      return 'Örn: Anksiyete, depresyon, stres'
    case 'dietitian':
      return 'Örn: Obezite, insülin direnci'
    default:
      return 'Örn: Teşhis...'
  }
}

/**
 * Tedavi planı alanı için sektöre özgü placeholder.
 */
export function getTreatmentPlanPlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
      return 'Kanal tedavisi → dolgu → kontrol planı...'
    case 'medical_aesthetic':
      return 'Seans sayısı, ürün, aralık...'
    case 'physiotherapy':
      return 'Seans programı, egzersizler, süre...'
    case 'veterinary':
      return 'Antibiyotik, kontrol, aşı...'
    case 'psychologist':
      return 'Terapi yaklaşımı, seans sayısı...'
    case 'dietitian':
      return 'Kalori, öğün, makro dağılımı...'
    default:
      return 'Tedavi planı detayları...'
  }
}

/**
 * Alerji alanı için sektöre özgü placeholder.
 */
export function getAllergiesPlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
      return 'Penisilin, lateks, lokal anestezi...'
    case 'medical_aesthetic':
      return 'Lidokain, salisilik asit, kozmetik ürün...'
    case 'veterinary':
      return 'İlaç, mama, çevresel...'
    default:
      return 'Bilinen alerjiler...'
  }
}

/**
 * Tedavi / protokol notları için sektöre özgü placeholder.
 */
export function getTreatmentNotesPlaceholder(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
      return 'Diş numarası, yapılan işlem, sonraki adım...'
    case 'medical_aesthetic':
      return 'Uygulanan ürün, yoğunluk, post-care...'
    case 'physiotherapy':
      return 'Egzersiz programı, ilerleme notları...'
    case 'veterinary':
      return 'Teşhis, uygulanan tedavi, kontrol tarihi...'
    default:
      return 'Tedavi notları...'
  }
}
