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
 * Normalize edilmiş 5XXXXXXXXX formatını E.164 (+905XXXXXXXXX) formatına çevirir.
 * DB'de tutarlı depolama için kullanılır — tüm yeni kayıtlar E.164 formatında saklanır.
 */
export function toE164Phone(normalized: string): string {
  if (!normalized) return normalized
  if (normalized.startsWith('+')) return normalized
  if (normalized.startsWith('90') && normalized.length > 10) return '+' + normalized
  return '+90' + normalized
}

/**
 * Supabase .or() filtresi için tüm olası telefon formatlarını döner.
 * DB'de 5XX, 05XX veya +905XX formatında kayıtlı olabilecek numaraları bulur.
 */
export function phoneOrFilter(normalized: string): string {
  return `phone.eq.${normalized},phone.eq.0${normalized},phone.eq.+90${normalized}`
}
