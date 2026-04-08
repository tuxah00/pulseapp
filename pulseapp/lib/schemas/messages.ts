/**
 * Ortak Türkçe form hata mesajları.
 *
 * Tüm zod schema'larında bu sabitleri kullan ki kullanıcıya görünen
 * mesajlar tutarlı olsun ve i18n ileride kolayca eklenebilsin.
 */

export const MSG = {
  REQUIRED: 'Bu alan zorunludur',
  TOO_SHORT: (min: number) => `En az ${min} karakter olmalı`,
  TOO_LONG: (max: number) => `En fazla ${max} karakter olabilir`,
  INVALID_EMAIL: 'Geçerli bir e-posta adresi girin',
  INVALID_PHONE: 'Geçerli bir telefon numarası girin (örn: 5XXXXXXXXX)',
  INVALID_DATE: 'Geçerli bir tarih girin',
  INVALID_NUMBER: 'Geçerli bir sayı girin',
  POSITIVE_NUMBER: 'Pozitif bir sayı olmalı',
} as const
