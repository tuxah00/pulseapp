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
