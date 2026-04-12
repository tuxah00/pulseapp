import { z } from 'zod'
import { MSG } from './messages'

/**
 * Public slots endpoint (GET /api/public/business/[id]/slots) query şeması.
 *
 * Query param'lar string olarak gelir — duration transform ile int'e çevrilir.
 */
export const slotsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT),
  duration: z
    .string()
    .transform((v) => parseInt(v, 10))
    .pipe(
      z
        .number({ message: MSG.INVALID_NUMBER })
        .int()
        .min(5, MSG.MIN_VALUE(5))
        .max(480, MSG.MAX_VALUE(480)),
    ),
  staffId: z.string().uuid(MSG.INVALID_UUID).optional(),
})

export type SlotsQueryInput = z.infer<typeof slotsQuerySchema>
