/**
 * WhatsApp mesaj şablonları
 * Twilio WhatsApp API ile gönderilen template mesajları.
 *
 * Not: WhatsApp Business API'de müşteriye 24 saat dışında mesaj göndermek için
 * önceden onaylanmış template kullanmak zorunludur.
 * Sandbox modunda template onayı gerekmez.
 */

export type WhatsAppTemplateType =
  | 'appointment_reminder'
  | 'appointment_confirmation'
  | 'appointment_confirmation_request'
  | 'birthday'
  | 'review_request'
  | 'winback'
  | 'booking_confirmation'
  | 'cancellation_notice'
  | 'follow_up'
  | 'post_care'
  // Ön Konsültasyon şablonları
  | 'consultation_received'
  | 'consultation_suitable'
  | 'consultation_not_suitable'
  | 'consultation_more_info'

export type WhatsAppTemplateCategory = 'randevu' | 'dogum_gunu' | 'follow_up' | 'kampanya' | 'konsultasyon'

export interface TemplateParams {
  customerName: string
  businessName: string
  [key: string]: string
}

/**
 * Placeholder metadata — UI'da form alanı olarak gösterilir.
 * `customerName` + `businessName` otomatik doldurulduğu için burada listelenmez.
 */
export interface TemplatePlaceholder {
  key: string
  label: string
  required: boolean
  placeholder?: string
}

export interface TemplateMeta {
  type: WhatsAppTemplateType
  label: string
  category: WhatsAppTemplateCategory
  placeholders: TemplatePlaceholder[]
}

export const TEMPLATE_CATEGORY_LABELS: Record<WhatsAppTemplateCategory, string> = {
  randevu: 'Randevu',
  dogum_gunu: 'Doğum Günü',
  follow_up: 'Takip / Bakım',
  kampanya: 'Kampanya',
  konsultasyon: 'Ön Konsültasyon',
}

/**
 * Her template'in UI gösterimi için metadata.
 * Kategori + Türkçe etiket + manuel doldurulacak placeholder listesi.
 */
export const TEMPLATE_META: Record<WhatsAppTemplateType, TemplateMeta> = {
  appointment_reminder: {
    type: 'appointment_reminder',
    label: 'Randevu Hatırlatma',
    category: 'randevu',
    placeholders: [
      { key: 'date', label: 'Tarih', required: true, placeholder: 'Örn: 24 Nisan 2026' },
      { key: 'time', label: 'Saat', required: true, placeholder: 'Örn: 14:30' },
      { key: 'serviceName', label: 'Hizmet Adı', required: false, placeholder: 'Örn: Lazer Epilasyon' },
    ],
  },
  appointment_confirmation: {
    type: 'appointment_confirmation',
    label: 'Randevu Onayı',
    category: 'randevu',
    placeholders: [
      { key: 'date', label: 'Tarih', required: true, placeholder: 'Örn: 24 Nisan 2026' },
      { key: 'time', label: 'Saat', required: true, placeholder: 'Örn: 14:30' },
      { key: 'serviceName', label: 'Hizmet Adı', required: false, placeholder: 'Örn: Botoks' },
    ],
  },
  appointment_confirmation_request: {
    type: 'appointment_confirmation_request',
    label: 'Randevu Onay Talebi (Evet/Hayır)',
    category: 'randevu',
    placeholders: [
      { key: 'date', label: 'Tarih', required: true, placeholder: 'Örn: 24 Nisan 2026' },
      { key: 'time', label: 'Saat', required: true, placeholder: 'Örn: 14:30' },
      { key: 'serviceName', label: 'Hizmet Adı', required: false, placeholder: 'Örn: Dolgu' },
    ],
  },
  booking_confirmation: {
    type: 'booking_confirmation',
    label: 'Rezervasyon Oluşturuldu',
    category: 'randevu',
    placeholders: [
      { key: 'date', label: 'Tarih', required: true, placeholder: 'Örn: 24 Nisan 2026' },
      { key: 'time', label: 'Saat', required: true, placeholder: 'Örn: 14:30' },
      { key: 'bookingUrl', label: 'Yönetim Linki', required: false, placeholder: 'https://…/book/manage/…' },
    ],
  },
  cancellation_notice: {
    type: 'cancellation_notice',
    label: 'Randevu İptali',
    category: 'randevu',
    placeholders: [
      { key: 'date', label: 'Tarih', required: true, placeholder: 'Örn: 24 Nisan 2026' },
      { key: 'time', label: 'Saat', required: true, placeholder: 'Örn: 14:30' },
    ],
  },
  birthday: {
    type: 'birthday',
    label: 'Doğum Günü Kutlaması',
    category: 'dogum_gunu',
    placeholders: [],
  },
  follow_up: {
    type: 'follow_up',
    label: 'Seans Sonrası Takip',
    category: 'follow_up',
    placeholders: [
      { key: 'serviceName', label: 'Hizmet / Tedavi', required: false, placeholder: 'Örn: Botoks' },
      { key: 'message', label: 'Kişisel Mesaj', required: false, placeholder: 'Nasıl hissediyorsunuz? Herhangi bir şikayetiniz var mı?' },
    ],
  },
  post_care: {
    type: 'post_care',
    label: 'Bakım Talimatları',
    category: 'follow_up',
    placeholders: [
      { key: 'serviceName', label: 'Hizmet / Tedavi', required: false, placeholder: 'Örn: Lazer' },
      { key: 'message', label: 'Talimatlar', required: true, placeholder: '• 24 saat güneşe çıkmayın\n• Sıcak su ile yıkamayın' },
    ],
  },
  review_request: {
    type: 'review_request',
    label: 'Yorum / Değerlendirme İsteği',
    category: 'kampanya',
    placeholders: [
      { key: 'reviewUrl', label: 'Değerlendirme Linki', required: false, placeholder: 'https://g.page/r/…' },
    ],
  },
  winback: {
    type: 'winback',
    label: 'Geri Kazanım (Winback)',
    category: 'kampanya',
    placeholders: [],
  },
  // ── Ön Konsültasyon ──
  consultation_received: {
    type: 'consultation_received',
    label: 'Konsültasyon Talebi Alındı',
    category: 'konsultasyon',
    placeholders: [],
  },
  consultation_suitable: {
    type: 'consultation_suitable',
    label: 'Konsültasyon — Uygun Bulundu',
    category: 'konsultasyon',
    placeholders: [
      { key: 'serviceName', label: 'Hizmet Adı', required: false, placeholder: 'Örn: Burun Estetiği' },
      { key: 'bookingUrl', label: 'Randevu Linki', required: false, placeholder: 'https://…/book/…' },
    ],
  },
  consultation_not_suitable: {
    type: 'consultation_not_suitable',
    label: 'Konsültasyon — Uygun Değil',
    category: 'konsultasyon',
    placeholders: [
      { key: 'reason', label: 'Gerekçe (opsiyonel)', required: false, placeholder: 'Örn: Mevcut durumunuz için farklı bir yaklaşım öneriyoruz.' },
    ],
  },
  consultation_more_info: {
    type: 'consultation_more_info',
    label: 'Konsültasyon — Ek Bilgi İsteniyor',
    category: 'konsultasyon',
    placeholders: [
      { key: 'message', label: 'İstenen Bilgi', required: true, placeholder: 'Örn: Son 6 aydaki ilaç kullanımınızı paylaşabilir misiniz?' },
    ],
  },
}

const templates: Record<WhatsAppTemplateType, (params: TemplateParams) => string> = {
  appointment_reminder: ({ customerName, businessName, date, time, serviceName }) =>
    `Merhaba ${customerName} 👋\n\n${businessName} randevunuzu hatırlatmak isteriz:\n📅 ${date}\n🕐 ${time}\n💆 ${serviceName || 'Randevu'}\n\nRandevunuzu değiştirmek veya iptal etmek için bize yazabilirsiniz.`,

  appointment_confirmation: ({ customerName, businessName, date, time, serviceName }) =>
    `Merhaba ${customerName} ✅\n\n${businessName} randevunuz onaylandı:\n📅 ${date}\n🕐 ${time}\n💆 ${serviceName || 'Randevu'}\n\nSizi bekliyoruz!`,

  appointment_confirmation_request: ({ customerName, businessName, date, time, serviceName }) =>
    `Merhaba ${customerName} 📋\n\n${businessName} randevunuzu hatırlatmak isteriz:\n📅 ${date}\n🕐 ${time}\n💆 ${serviceName || 'Randevu'}\n\nRandevunuza gelecek misiniz?\n✅ EVET — onaylamak için\n❌ HAYIR — iptal etmek için\n\nLütfen EVET veya HAYIR yazarak yanıtlayın.`,

  birthday: ({ customerName, businessName }) =>
    `Doğum gününüz kutlu olsun ${customerName}! 🎂🎉\n\n${businessName} olarak sizin için özel bir sürprizimiz var. Detaylar için bize ulaşın!`,

  review_request: ({ customerName, businessName, reviewUrl }) =>
    `Merhaba ${customerName} 😊\n\n${businessName} ziyaretiniz için teşekkür ederiz! Deneyiminizi değerlendirir misiniz?\n\n⭐ ${reviewUrl || 'Bize geri bildiriminizi paylaşabilirsiniz.'}`,

  winback: ({ customerName, businessName }) =>
    `Merhaba ${customerName} 💐\n\nSizi özledik! ${businessName} olarak sizin için özel bir teklif hazırladık. Detaylar için yanıtlayın veya bizi arayın.`,

  booking_confirmation: ({ customerName, businessName, date, time, bookingUrl }) =>
    `Merhaba ${customerName} 📋\n\n${businessName} randevunuz oluşturuldu:\n📅 ${date}\n🕐 ${time}\n\n${bookingUrl ? `Randevunuzu yönetmek için: ${bookingUrl}` : 'Değişiklik için bize yazabilirsiniz.'}`,

  cancellation_notice: ({ customerName, businessName, date, time }) =>
    `Merhaba ${customerName}\n\n${businessName} ${date} tarihli ${time} saatli randevunuz iptal edilmiştir.\n\nYeni randevu almak için bize yazabilirsiniz.`,

  follow_up: ({ customerName, businessName, serviceName, message }) =>
    `Merhaba ${customerName} 💙\n\n${businessName} olarak ${serviceName || 'tedaviniz'} sonrasında durumunuzu merak ediyoruz.\n\n${message || 'Herhangi bir sorunuz veya şikayetiniz varsa bize yazabilirsiniz.'}\n\nSağlıklı günler dileriz! 🌿`,

  post_care: ({ customerName, businessName, serviceName, message }) =>
    `Merhaba ${customerName} 📋\n\n${businessName} - ${serviceName || 'Tedavi'} Sonrası Bakım Talimatları:\n\n${message}\n\nSorularınız için bize ulaşabilirsiniz.`,

  // ── Ön Konsültasyon ──
  consultation_received: ({ customerName, businessName }) =>
    `Merhaba ${customerName} 🙏\n\n${businessName} ön konsültasyon talebinizi aldık. Uzmanlarımız en kısa sürede inceleyip size dönüş yapacaktır.\n\nTeşekkür ederiz!`,

  consultation_suitable: ({ customerName, businessName, serviceName, bookingUrl }) =>
    `Merhaba ${customerName} ✅\n\n${businessName} ekibimiz konsültasyon talebinizi inceledi. ${serviceName ? `*${serviceName}* için` : ''} uygun olduğunuzu değerlendirdik.\n\n${bookingUrl ? `Randevu almak için: ${bookingUrl}` : 'Randevu almak için bize yazabilirsiniz.'}\n\nSağlıklı günler dileriz! 😊`,

  consultation_not_suitable: ({ customerName, businessName, reason }) =>
    `Merhaba ${customerName}\n\n${businessName} ekibimiz konsültasyon talebinizi özenle inceledi.\n\n${reason || 'Mevcut durumunuz için şu an farklı bir yaklaşım öneriyoruz.'}\n\nSorularınız için her zaman ulaşabilirsiniz. 💙`,

  consultation_more_info: ({ customerName, businessName, message }) =>
    `Merhaba ${customerName} 📋\n\n${businessName} konsültasyon talebinizi değerlendirirken ek bilgiye ihtiyaç duyduk:\n\n${message}\n\nBu soruları yanıtladıktan sonra size en doğru değerlendirmeyi yapabiliriz.`,
}

/**
 * WhatsApp template mesajı oluşturur.
 */
export function generateWhatsAppMessage(
  type: WhatsAppTemplateType,
  params: TemplateParams
): string {
  const generator = templates[type]
  return generator(params)
}

/**
 * Tüm mevcut template tiplerini döndürür.
 */
export function getAvailableTemplates(): WhatsAppTemplateType[] {
  return Object.keys(templates) as WhatsAppTemplateType[]
}

/** Zod enum / runtime kontrol için tuple biçiminde template tipleri — `WhatsAppTemplateType` ile tek kaynak. */
export const WA_TEMPLATE_TYPES = Object.keys(TEMPLATE_META) as [WhatsAppTemplateType, ...WhatsAppTemplateType[]]
