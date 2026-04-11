import { z } from 'zod'
import { MSG } from './messages'
import { phoneField } from './customer'

/**
 * Public booking endpoint (POST /api/public/business/[id]/book) şeması.
 *
 * phone alanı '5XXXXXXXXX' formatına normalize edilir.
 * Route'ta '+90' prefix eklenerek DB'ye yazılır.
 */
export const publicBookingSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, MSG.TOO_SHORT(2))
    .max(100, MSG.TOO_LONG(100)),
  phone: phoneField,
  serviceId: z.string().uuid(MSG.INVALID_UUID),
  staffId: z.string().uuid(MSG.INVALID_UUID).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT),
  notes: z
    .string()
    .trim()
    .max(500, MSG.TOO_LONG(500))
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type PublicBookingInput = z.infer<typeof publicBookingSchema>
