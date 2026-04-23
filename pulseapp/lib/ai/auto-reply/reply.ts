/**
 * Otomatik yanıt üretici (Faz 1)
 *
 * `whitelist` modunda: sabit şablon cevaplar (adres, saat, booking link).
 * `smart` modunda: GPT-4o Mini serbest yanıt (işletme bağlamı + niyet ile).
 *
 * Hiçbir yazma eylemi yapmaz — sadece metin döner. Randevu/iptal niyetleri
 * webhook tarafında `ai_pending_actions` kuyruğuna taslak olarak düşer.
 */
import { getOpenAIClient, REPLY_MODEL } from '@/lib/ai/openai-client'
import { SECTOR_CONTEXT } from '@/lib/ai/prompts'
import type { SectorType, WorkingHours } from '@/types'
import { createLogger } from '@/lib/utils/logger'
import type { AutoReplyIntent } from './classify'

const log = createLogger({ module: 'ai/auto-reply/reply' })

export interface BusinessContext {
  id: string
  name: string
  sector: SectorType
  phone?: string | null
  address?: string | null
  city?: string | null
  district?: string | null
  googleMapsUrl?: string | null
  workingHours?: WorkingHours | null
  bookingLink: string
}

export type AutoReplyMode = 'whitelist' | 'smart'

export interface ReplyParams {
  intent: AutoReplyIntent
  message: string
  mode: AutoReplyMode
  business: BusinessContext
  customerName?: string
  /** Son 5 outbound + inbound mesaj — smart modda bağlam için */
  recentMessages?: Array<{ direction: 'inbound' | 'outbound'; content: string }>
}

export interface ReplyResult {
  text: string | null
  /** true → staff'a bildirim git, otomatik cevap verme (örn. complaint) */
  alertStaffOnly?: boolean
  /** true → randevu/iptal niyeti var, pending_actions'a taslak düşür */
  queueAction?: { type: 'appointment_request' | 'appointment_cancel' | 'appointment_reschedule' }
}

// ─── Whitelist şablonları ───────────────────────────────────────

const DAY_LABELS: Record<keyof WorkingHours, string> = {
  mon: 'Pzt', tue: 'Sal', wed: 'Çar', thu: 'Per', fri: 'Cum', sat: 'Cmt', sun: 'Paz',
}

function formatHours(wh: WorkingHours | null | undefined): string {
  if (!wh) return 'Çalışma saatleri bilgisi henüz tanımlanmamış.'
  return Object.entries(DAY_LABELS)
    .map(([key, label]) => {
      const h = wh[key as keyof WorkingHours]
      return h ? `${label}: ${h.open}-${h.close}` : `${label}: Kapalı`
    })
    .join(', ')
}

function whitelistReply(intent: AutoReplyIntent, business: BusinessContext): string | null {
  switch (intent) {
    case 'question_hours':
      return `Merhaba! ${business.name} çalışma saatlerimiz:\n${formatHours(business.workingHours)}`
    case 'question_location': {
      const addr = business.address
        ? `${business.address}, ${business.district || ''}/${business.city || ''}`.replace(/^,\s*|\s*,\s*\//g, '/')
        : null
      if (business.googleMapsUrl && addr) {
        return `Merhaba! ${business.name} adresimiz: ${addr}\nGoogle Maps: ${business.googleMapsUrl}`
      }
      if (addr) return `Merhaba! ${business.name} adresimiz: ${addr}`
      return `Adres bilgimiz henüz yayında değil, bizi arayabilirsiniz${business.phone ? `: ${business.phone}` : ''}.`
    }
    case 'appointment_request':
    case 'appointment_reschedule':
      return `Merhaba! Online randevu almak/değiştirmek için: ${business.bookingLink}${business.phone ? `\nYardım için: ${business.phone}` : ''}`
    case 'appointment_cancel':
      return `Randevu iptal talebinizi aldık, kısa süre içinde dönüş yapacağız.${business.phone ? ` Acil durumlarda: ${business.phone}` : ''}`
    case 'question_price':
      return `Fiyatlarımız hizmete göre değişmektedir. Detaylı bilgi ve randevu için: ${business.bookingLink}${business.phone ? ` veya ${business.phone}` : ''}`
    case 'question_service':
      return `Hizmetlerimiz ve detayları için: ${business.bookingLink}${business.phone ? `\nYardım için: ${business.phone}` : ''}`
    case 'greeting':
      return `Merhaba! ${business.name}'e hoş geldiniz. Size nasıl yardımcı olabiliriz?`
    case 'complaint':
      return null // complaint → alertStaffOnly
    case 'other':
    default:
      return null // otomatik cevap yok, personel görür
  }
}

// ─── Smart mod (GPT-4o Mini) ─────────────────────────────────────

function buildSmartSystemPrompt(business: BusinessContext, customerName?: string): string {
  const addressBlock = business.address
    ? `Adres: ${business.address}${business.district ? `, ${business.district}` : ''}${business.city ? `/${business.city}` : ''}${business.googleMapsUrl ? ` (Maps: ${business.googleMapsUrl})` : ''}`
    : 'Adres: henüz tanımlı değil'

  return `Sen ${business.name} adlı işletmenin otomatik yanıt asistanısın. Bu işletmede ${SECTOR_CONTEXT[business.sector]}.

İşletme bilgileri:
- Çalışma saatleri: ${formatHours(business.workingHours)}
- ${addressBlock}
- Telefon: ${business.phone || 'henüz tanımlı değil'}
- Online randevu linki: ${business.bookingLink}

${customerName ? `Müşteri: ${customerName}` : ''}

Kurallar:
- Türkçe, samimi ama profesyonel (2-3 cümle, max 300 karakter)
- Emoji kullanma veya max 1 tane
- Randevu talebi varsa booking link'i paylaş, ASLA kendin saat teklif etme (gerçek takvimi bilmiyorsun)
- Fiyat sorusunda: "hizmete göre değişir, randevu linkinden detayları görebilirsiniz" şeklinde
- Müşteriye ASLA başka müşterinin bilgisini verme
- Tıbbi/hukuki/finansal tavsiye VERME
- Kesin tarih/saat/fiyat taahhüdü VERME (personel değilsin)
- Kısa ve net kal. Yanıtın sonuna imza/etiket EKLEME (sistem ekleyecek).

SADECE müşteriye gidecek metni döndür — başka açıklama yazma.`
}

async function smartReply(params: ReplyParams): Promise<string | null> {
  const { message, business, customerName, recentMessages } = params
  const client = getOpenAIClient()

  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: buildSmartSystemPrompt(business, customerName) },
  ]

  // Son 5 mesajı bağlam olarak ekle (kayma riski düşük çünkü sistem promptu sıkı)
  for (const m of recentMessages?.slice(-5) ?? []) {
    messages.push({
      role: m.direction === 'inbound' ? 'user' : 'assistant',
      content: m.content,
    })
  }
  messages.push({ role: 'user', content: message })

  try {
    const response = await client.chat.completions.create({
      model: REPLY_MODEL,
      max_tokens: 200,
      temperature: 0.5,
      messages,
    })
    const text = response.choices[0]?.message?.content?.trim() || ''
    return text || null
  } catch (err) {
    log.error({ err, businessId: business.id }, 'Smart reply üretme hatası')
    return null
  }
}

// ─── Ana entrypoint ──────────────────────────────────────────────

export async function generateReply(params: ReplyParams): Promise<ReplyResult> {
  const { intent, mode } = params

  // Complaint her modda staff'a gider, otomatik cevap yok
  if (intent === 'complaint') {
    return { text: null, alertStaffOnly: true }
  }

  // Randevu/iptal/reschedule niyetleri → pending_actions taslağı
  const queueAction = intent === 'appointment_request' || intent === 'appointment_cancel' || intent === 'appointment_reschedule'
    ? { type: intent }
    : undefined

  if (mode === 'whitelist') {
    return { text: whitelistReply(intent, params.business), queueAction }
  }

  // smart mod
  const text = await smartReply(params)
  return { text, queueAction }
}

/**
 * Otomatik yanıt mesajının sonuna şeffaflık etiketi ekler (KVKK + beklenti yönetimi).
 */
export function withSignature(text: string): string {
  return `${text}\n\n— Otomatik yanıt`
}
