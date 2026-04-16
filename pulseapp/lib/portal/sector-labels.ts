/**
 * Portal içinde sektöre göre dinamik başlık ve metin eşlemesi.
 * UI tutarlılığı için bir noktadan yönetilir.
 */

type SectorKey = string | null | undefined

const CLINIC_SECTORS = new Set([
  'dental_clinic',
  'medical_aesthetic',
  'physiotherapy',
  'veterinary',
])

export function isClinicSector(sector: SectorKey): boolean {
  return !!sector && CLINIC_SECTORS.has(sector)
}

/**
 * "Dosyalarım" / "Röntgenler & Fotoğraflar" vb.
 */
export function getFilesPageTitle(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
    case 'medical_aesthetic':
      return 'Röntgenler & Fotoğraflar'
    case 'psychologist':
      return 'Seans Notlarım'
    case 'hair_salon':
    case 'barber':
      return 'Portföyüm'
    case 'veterinary':
      return 'Dosyalarım'
    case 'dietitian':
      return 'Beslenme Planlarım'
    case 'physiotherapy':
      return 'Tedavi Dosyalarım'
    default:
      return 'Dosyalarım'
  }
}

export function getFilesPageSubtitle(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
    case 'medical_aesthetic':
      return 'Klinik fotoğrafların ve röntgen kayıtların burada.'
    case 'psychologist':
      return 'Seans notların ve paylaşılan kaynaklar burada.'
    case 'hair_salon':
    case 'barber':
      return 'Senin için çekilen fotoğrafların burada.'
    case 'veterinary':
      return 'Dostunun sağlık ve tedavi kayıtları burada.'
    case 'dietitian':
      return 'Beslenme planın ve takip dosyaların burada.'
    default:
      return 'Sana ait dosyalar ve fotoğraflar burada.'
  }
}

/**
 * "Tedavilerim" / "Seanslarım"
 */
export function getTreatmentsPageTitle(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
      return 'Tedavilerim'
    case 'medical_aesthetic':
      return 'Tedavi & Paketlerim'
    case 'physiotherapy':
      return 'Tedavi Programım'
    case 'veterinary':
      return 'Tedavi Planları'
    default:
      return 'Tedavilerim'
  }
}

/**
 * Kullanıcıya gösterilen saygı ifadeleri vs.
 */
export function getGreetingSuffix(sector: SectorKey): string {
  switch (sector) {
    case 'dental_clinic':
    case 'medical_aesthetic':
    case 'physiotherapy':
      return '' // Hastalarda direkt isim
    case 'psychologist':
      return ''
    default:
      return ''
  }
}
