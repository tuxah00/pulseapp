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
  INVALID_UUID: 'Geçerli bir UUID olmalı',
  MIN_VALUE: (min: number) => `En az ${min} olmalı`,
  MAX_VALUE: (max: number) => `En fazla ${max} olmalı`,
  NON_NEGATIVE: 'Negatif bir sayı olamaz',
  INVALID_ENUM: (values: string[]) => `Geçerli değerler: ${values.join(', ')}`,
  MIN_ITEMS: (min: number) => `En az ${min} öğe olmalı`,
  INVALID_DATE_FORMAT: 'Geçerli bir tarih girin (YYYY-AA-GG)',
  INVALID_TIME_FORMAT: 'Geçerli bir saat girin (SS:DD)',
  BIRTHDAY_MIN_AGE: 'Lütfen geçerli bir doğum tarihi girin. Müşteri en az 2 yaşında olmalı.',
  BIRTHDAY_INVALID_YEAR: 'Geçersiz doğum yılı',
} as const
