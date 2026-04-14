import { z } from 'zod'
import { MSG } from './messages'
import { phoneField } from './customer'

/**
 * Auto-book endpoint (POST /api/public/business/[id]/auto-book) şeması.
 *
 * 14 gün içinde en yakın müsait slotu bulup otomatik randevu oluşturur.
 * phone alanı '5XXXXXXXXX' formatına normalize edilir.
 */
export const autoBookSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, MSG.TOO_SHORT(2))
    .max(100, MSG.TOO_LONG(100)),
  phone: phoneField,
  serviceId: z.string().uuid(MSG.INVALID_UUID),
  staffId: z.string().uuid(MSG.INVALID_UUID).optional(),
  notes: z
    .string()
    .trim()
    .max(500, MSG.TOO_LONG(500))
    .optional()
    .or(z.literal('').transform(() => undefined)),
})

export type AutoBookInput = z.infer<typeof autoBookSchema>
