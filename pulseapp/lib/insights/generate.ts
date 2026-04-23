// ================================================
// lib/insights/generate.ts
// Dataset → InsightBlock üretici
// ================================================
// API endpoint'leri dataset hazırladıktan sonra bu fonksiyonu çağırır ve
// standart bir InsightBlock döndürür. İçeride kural sıralaması önemli:
// en spesifik şablon ilk sırada, genel "healthy/empty" son sırada yer alır.
// Hiçbir şablon eşleşmezse boş severity=info blok döner.

import { TEMPLATE_REGISTRY, type TemplateInputMap } from './templates'
import type { InsightBlock, InsightCategory, InsightTemplate } from './types'

export function generateInsight<K extends InsightCategory>(
  category: K,
  input: TemplateInputMap[K]
): InsightBlock {
  const templates = TEMPLATE_REGISTRY[category] as InsightTemplate<
    TemplateInputMap[K]
  >[]

  for (const tpl of templates) {
    try {
      if (tpl.match(input)) {
        const payload = tpl.generate(input)
        return {
          template_key: tpl.key,
          category,
          ...payload,
        }
      }
    } catch (err) {
      // Tek şablon hatası panel çökertmesin — logla, sıradaki şablona geç.
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[insights] template ${tpl.key} failed`, err)
      }
    }
  }

  // Fallback — hiçbir şablon eşleşmediğinde veri yok mesajı üret.
  return {
    template_key: `${category}_no_match`,
    category,
    severity: 'info',
    title: 'Bu bölüm için önerilecek veri yok',
    message: `Seçili dönemde anlamlı bir örüntü tespit edilmedi. Veri biriktikçe bu kutu kendi kendine dolar.`,
    actions: [],
  }
}

/**
 * API endpoint'lerinin toplu kullanabilmesi için — birden fazla kategori
 * datasetini tek seferde üretir.
 */
export function generateMany(inputs: {
  [K in InsightCategory]?: TemplateInputMap[K]
}): InsightBlock[] {
  const results: InsightBlock[] = []
  for (const key of Object.keys(inputs) as InsightCategory[]) {
    const input = inputs[key]
    if (input == null) continue
    results.push(generateInsight(key, input as TemplateInputMap[typeof key]))
  }
  return results
}
