/**
 * Faz 3 — Skill Paketleri
 * Her skill paketi bir grup araç (tool) içerir ve belirli sektörlere uygulanır.
 */

export type SkillId =
  | 'common'           // Tüm sektörlerde ortak araçlar
  | 'analytics'        // Gelişmiş analitik + strateji araçları
  | 'medical-aesthetic' // Estetik klinik özel araçlar
  | 'dental-clinic'    // Diş kliniği özel araçlar
  | 'hair-beauty'      // Kuaför / güzellik salonu araçları (gelecek)

export interface SkillPackageInfo {
  id: SkillId
  name: string
  description: string
}

export const SKILL_PACKAGE_INFO: Record<SkillId, SkillPackageInfo> = {
  common: {
    id: 'common',
    name: 'Ortak Araçlar',
    description: 'Randevu, müşteri, mesaj, personel, finans gibi tüm sektörlere uygulanabilen temel araçlar.',
  },
  analytics: {
    id: 'analytics',
    name: 'Analitik & Strateji',
    description: 'Gelişmiş gelir analizi, doluluk, personel performansı, anomali tespiti ve stratejik öneriler.',
  },
  'medical-aesthetic': {
    id: 'medical-aesthetic',
    name: 'Estetik Klinik',
    description: 'Tedavi protokolleri, seans takibi, müşteri alerjileri ve kontrendikasyon kontrolü.',
  },
  'dental-clinic': {
    id: 'dental-clinic',
    name: 'Diş Kliniği',
    description: 'Diş haritası, diş durumu takibi ve dental kayıt yönetimi.',
  },
  'hair-beauty': {
    id: 'hair-beauty',
    name: 'Kuaför & Güzellik',
    description: 'Stilist eşleştirme ve öncesi/sonrası fotoğraf araçları. (Geliştirilmekte)',
  },
}
