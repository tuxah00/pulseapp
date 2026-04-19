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
