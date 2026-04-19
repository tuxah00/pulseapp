import { z } from 'zod'
import { MSG } from './messages'
import { normalizePhone } from '@/lib/utils/phone'

/**
 * Türk telefon numarası — kullanıcı "0532 123 45 67", "532 123 45 67",
 * "+90 532 123 45 67" gibi varyasyonlarla girebilir. Schema input'tan
 * 10 haneli "5XXXXXXXXX" formatına normalize eder.
 */
export const phoneField = z
  .string()
  .trim()
  .min(1, MSG.REQUIRED)
  .transform((raw) => normalizePhone(raw))
  .refine((d) => /^5\d{9}$/.test(d), { message: MSG.INVALID_PHONE })

/**
 * Müşteri oluşturma şeması.
 *
 * Telefon zorunlu (SMS gönderimi için kritik). E-posta opsiyonel.
 * `notes` ve `email` boş string ise null'a çevrilir.
 */
export const customerCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, MSG.TOO_SHORT(2))
    .max(100, MSG.TOO_LONG(100)),
  phone: phoneField,
  email: z
    .string()
    .trim()
    .email(MSG.INVALID_EMAIL)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: z
    .string()
    .trim()
    .max(500, MSG.TOO_LONG(500))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  birthday: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Geçersiz tarih formatı')
    .refine((d) => {
      const minAge = new Date()
      minAge.setFullYear(minAge.getFullYear() - 2)
      return d <= minAge.toISOString().slice(0, 10)
    }, { message: 'Lütfen geçerli bir doğum tarihi girin. Müşteri en az 2 yaşında olmalı.' })
    .refine((d) => {
      const year = parseInt(d.slice(0, 4), 10)
      return year >= 1900 && year <= new Date().getFullYear()
    }, { message: 'Geçersiz doğum yılı' })
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>

/**
 * Güncelleme şeması — tüm alanlar opsiyonel.
 */
export const customerUpdateSchema = customerCreateSchema.partial()
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>
