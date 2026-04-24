import { randomBytes } from 'crypto'

/**
 * Karışık olabilecek karakterler (O/0, I/1, l) kasıtlı olarak çıkarıldı.
 * 54 karakter × 8 uzunluk = ~72 trilyon kombinasyon, collision pratikte sıfır.
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'

/**
 * URL-safe, insan-okunaklı kısa kod üretir.
 * Kampanya SMS'lerinde /r/<code> formatında kullanılır.
 */
export function generateShortCode(length = 8): string {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}
