import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { getAllowedToolNamesForSector, getSkillsForSector } from './registry'

/**
 * Sektöre göre ilgili araçları (tool) filtreler.
 *
 * Örnek: medical_aesthetic sektörü için common + analytics + medical-aesthetic araçları
 * yüklenir; dental-clinic araçları (list_tooth_records vb.) bağlama eklenmez.
 *
 * Bu sayede:
 * - Model bağlamı küçülür (token tasarrufu)
 * - Alakasız tool önerileri azalır
 * - Prompt caching hit oranı artar (stabil araç listesi)
 */
export function loadToolsForSector(
  sector: string,
  allTools: ChatCompletionTool[],
): ChatCompletionTool[] {
  const allowedNames = getAllowedToolNamesForSector(sector)
  return allTools.filter(
    t => t.type === 'function' && allowedNames.has(t.function.name),
  )
}

/**
 * Hangi skill paketleri yüklendiğini döner (log / debug için).
 */
export function getLoadedSkillIds(sector: string): string[] {
  return getSkillsForSector(sector)
}

/**
 * Bir aracın (tool) belirli bir sektörde mevcut olup olmadığını kontrol eder.
 */
export function isToolAvailableForSector(toolName: string, sector: string): boolean {
  return getAllowedToolNamesForSector(sector).has(toolName)
}
