/**
 * Otomatik yanıt sınıflandırıcı (Faz 1)
 *
 * Webhook'tan gelen ham mesajı GPT-4o Mini ile analiz eder, niyet + güven skoru döner.
 * Asistandan ayrıdır — webhook context'i (anonim müşteri, auth yok) için tasarlanmıştır.
 *
 * Maliyet: ~150 input + 50 output token = $0.00005/çağrı.
 */
import { getOpenAIClient, CLASSIFY_MODEL } from '@/lib/ai/openai-client'
import { SECTOR_CONTEXT } from '@/lib/ai/prompts'
import type { SectorType } from '@/types'
import { createLogger } from '@/lib/utils/logger'

const log = createLogger({ module: 'ai/auto-reply/classify' })

/** Webhook niyet şeması — asistan panelindeki AiClassification'dan daha granüler */
export const AUTO_REPLY_INTENTS = [
  'appointment_request',      // randevu almak istiyor
  'appointment_cancel',       // mevcut randevusunu iptal
  'appointment_reschedule',   // tarih/saat değişikliği
  'question_hours',           // çalışma saati
  'question_location',        // adres/yol tarifi
  'question_price',           // fiyat sorusu
  'question_service',         // hizmet detay sorusu
  'complaint',                // şikayet
  'greeting',                 // selamlaşma
  'other',                    // belirsiz
] as const
export type AutoReplyIntent = (typeof AUTO_REPLY_INTENTS)[number]

export interface ClassifyResult {
  intent: AutoReplyIntent
  confidence: number
  summary: string
}

export interface ClassifyParams {
  message: string
  businessName: string
  sector: SectorType
}

function buildSystemPrompt(businessName: string, sector: SectorType): string {
  return `Sen ${businessName} adlı işletmenin gelen mesaj sınıflandırıcısısın. Bu işletmede ${SECTOR_CONTEXT[sector]}.

Gelen mesajı aşağıdaki niyet kategorilerinden BİRİNE sınıflandır:
- "appointment_request": Randevu almak istiyor ("randevu alabilir miyim", "yarın boşluk var mı")
- "appointment_cancel": Mevcut randevusunu iptal ("iptal etmek istiyorum")
- "appointment_reschedule": Tarih/saat değişikliği ("başka güne alabilir miyiz")
- "question_hours": Çalışma saati sorusu ("kaçta açıksınız", "pazar açık mı")
- "question_location": Adres/yol ("neredesiniz", "adres", "konum")
- "question_price": Fiyat ("ne kadar", "kaç para", "ücret")
- "question_service": Hizmet detayı ("bu hizmeti yapıyor musunuz", "ne kadar sürer")
- "complaint": Şikayet/memnuniyetsizlik ("berbat", "kötü", "şikayet")
- "greeting": Selam/teşekkür ("merhaba", "iyi günler", "teşekkürler")
- "other": Yukarıdakilerin hiçbiri

SADECE şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{"intent":"<kategori>","confidence":<0.0-1.0>,"summary":"<1 cümle Türkçe özet>"}`
}

export async function classifyInbound(params: ClassifyParams): Promise<ClassifyResult> {
  const { message, businessName, sector } = params
  const client = getOpenAIClient()

  try {
    const response = await client.chat.completions.create({
      model: CLASSIFY_MODEL,
      max_tokens: 150,
      messages: [
        { role: 'system', content: buildSystemPrompt(businessName, sector) },
        { role: 'user', content: message },
      ],
      response_format: { type: 'json_object' },
    })

    const text = response.choices[0]?.message?.content || ''
    const parsed = JSON.parse(text) as Partial<ClassifyResult>

    const intent = (parsed.intent && (AUTO_REPLY_INTENTS as readonly string[]).includes(parsed.intent))
      ? parsed.intent as AutoReplyIntent
      : 'other'
    const confidence = Math.max(0, Math.min(1, parsed.confidence ?? 0.5))
    const summary = parsed.summary || 'Sınıflandırılamadı'

    return { intent, confidence, summary }
  } catch (err) {
    log.error({ err, businessName }, 'Otomatik yanıt sınıflandırma hatası')
    return { intent: 'other', confidence: 0, summary: 'Sınıflandırma başarısız' }
  }
}
