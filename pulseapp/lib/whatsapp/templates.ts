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

interface TemplateParams {
  customerName: string
  businessName: string
  [key: string]: string
}

interface WhatsAppTemplate {
  type: WhatsAppTemplateType
  generate: (params: TemplateParams) => string
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
