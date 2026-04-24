/**
 * Telefon numarasını 5XXXXXXXXX formatına normalize eder.
 * Tüm API route'larında ve Zod şemasında ortak kullanılır.
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/[\s\-\(\)\+]/g, '')
  if (digits.startsWith('90') && digits.length > 10) digits = digits.slice(2)
  if (digits.startsWith('0')) digits = digits.slice(1)
  return digits
}

/**
 * Supabase .or() filtresi için tüm olası telefon formatlarını döner.
 * DB'de 5XX, 05XX veya +905XX formatında kayıtlı olabilecek numaraları bulur.
 */
export function phoneOrFilter(normalized: string): string {
  return `phone.eq.${normalized},phone.eq.0${normalized},phone.eq.+90${normalized}`
}

/**
 * TR telefon numarasını E.164 / Meta / Twilio formatlarına dönüştürür.
 * - E.164 (default): `+905XXXXXXXXX` — Twilio SMS/WhatsApp için
 * - 'digits': `905XXXXXXXXX` (+ işareti olmadan) — Meta Cloud API için
 *
 * Zaten + ile başlayan non-TR numaralar aynen döndürülür (defensive).
 */
export function formatTrPhone(phone: string, format: 'e164' | 'digits' = 'e164'): string {
  const cleaned = phone.replace(/\D/g, '')
  let digits: string
  if (cleaned.startsWith('90') && cleaned.length === 12) digits = cleaned
  else if (cleaned.startsWith('0') && cleaned.length === 11) digits = `9${cleaned.slice(1)}`
  else if (cleaned.length === 10) digits = `90${cleaned}`
  else if (!phone.startsWith('+')) return `+${cleaned}` // yabancı numara — olduğu gibi E.164
  else return phone
  return format === 'e164' ? `+${digits}` : digits
}
