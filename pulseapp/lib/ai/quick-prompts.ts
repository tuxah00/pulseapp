import type { SectorType } from '@/types'
import { getCustomerLabel } from '@/lib/config/sector-modules'

/**
 * Sektör + günün saatine göre akıllı hazır öneriler üretir.
 * Amaç: kullanıcıya o an sormak isteyeceği yüksek olasılıklı soruları sunmak.
 */

type PromptContext = {
  sector: SectorType
  hour?: number // 0-23
}

const MEDICAL_SECTORS: SectorType[] = [
  'medical_aesthetic',
  'dental_clinic',
  'physiotherapy',
  'veterinary',
  'psychologist',
  'dietitian',
]

function isMedical(sector: SectorType): boolean {
  return MEDICAL_SECTORS.includes(sector)
}

export function getSmartPrompts(ctx: PromptContext): string[] {
  const { sector, hour = new Date().getHours() } = ctx
  const customerLabel = getCustomerLabel(sector)
  const customerSingular = customerLabel.replace(/ler$|lar$/, '')

  const base: string[] = []

  // Güne göre — sabah: bugünün planı, öğleden sonra: haftanın durumu, akşam: gün sonu özeti
  if (hour >= 5 && hour < 12) {
    base.push('Bugünkü randevularım neler?')
    base.push(isMedical(sector) ? 'Bugün hangi protokoller var?' : 'Bu sabah boş slotlarım var mı?')
  } else if (hour >= 12 && hour < 18) {
    base.push('Bu haftaki randevu yoğunluğum nasıl?')
    base.push(`Risk altındaki ${customerLabel.toLowerCase()} kimler?`)
  } else {
    base.push('Bugünün özeti nedir?')
    base.push('Bu ay geliri geçen aya göre nasıl?')
  }

  // Sektöre özel sorular
  if (isMedical(sector)) {
    base.push('En çok gelir getiren tedaviler hangileri?')
    base.push(`Takip gerektiren ${customerSingular.toLowerCase()} var mı?`)
  } else if (sector === 'restaurant' || sector === 'cafe') {
    base.push('Bu haftaki rezervasyonlar nasıl?')
    base.push('En çok tercih edilen masa hangisi?')
  } else if (sector === 'auto_service' || sector === 'car_wash') {
    base.push('Bekleyen siparişler neler?')
    base.push(`Geri dönmeyen ${customerLabel.toLowerCase()} kimler?`)
  } else {
    // Genel (kuaför, berber, güzellik vb.)
    base.push('Hizmetlerimi listele')
    base.push('En iyi personelim kim?')
  }

  // Her zaman iş zekası önerisi
  base.push('İşletmem için stratejik tavsiyeler ver')

  return base.slice(0, 5)
}
