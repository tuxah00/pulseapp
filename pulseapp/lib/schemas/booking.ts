import { z } from 'zod'
import { MSG } from './messages'
import { phoneField } from './customer'

/**
 * Ortak alan tanımları — hem camelCase hem snake_case schema'lar tarafından paylaşılır.
 */
const NAME = z
  .string()
  .trim()
  .min(2, MSG.TOO_SHORT(2))
  .max(100, MSG.TOO_LONG(100))

const SERVICE_ID = z.string().uuid(MSG.INVALID_UUID)
const STAFF_ID = z.string().uuid(MSG.INVALID_UUID).optional()
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT)
const TIME = z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT)
const NOTES = z
  .string()
  .trim()
  .max(500, MSG.TOO_LONG(500))
  .optional()
  .or(z.literal('').transform(() => undefined))

/**
 * Public booking endpoint (POST /api/public/business/[id]/book) şeması.
 * camelCase alan isimlendirmesi.
 *
 * Not: Şu an frontend tarafı bu endpoint'i kullanmıyor, ancak şema
 * gelecekte yeni client'lar için hazır tutuluyor.
 */
export const publicBookingSchema = z.object({
  name: NAME,
  phone: phoneField,
  serviceId: SERVICE_ID,
  staffId: STAFF_ID,
  date: DATE,
  startTime: TIME,
  notes: NOTES,
})

export type PublicBookingInput = z.infer<typeof publicBookingSchema>

/**
 * Legacy booking endpoint (POST /api/book) şeması.
 *
 * snake_case alan isimlendirmesi — `/book/[businessId]` sayfası bu alan
 * isimleriyle istek atar. Değiştirmemek için legacy şema ayrı tutuldu.
 */
export const legacyBookingSchema = z.object({
  customer_name: NAME,
  customer_phone: phoneField,
  service_id: SERVICE_ID,
  staff_id: STAFF_ID,
  appointment_date: DATE,
  start_time: TIME,
  notes: NOTES,
})

export type LegacyBookingInput = z.infer<typeof legacyBookingSchema>
