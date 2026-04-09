import { z } from 'zod'
import { MSG } from './messages'

/**
 * Alerji oluşturma şeması.
 */
export const allergyCreateSchema = z.object({
  businessId: z.string().uuid(MSG.INVALID_UUID),
  customerId: z.string().uuid(MSG.INVALID_UUID),
  allergen: z.string().trim().min(1, MSG.REQUIRED).max(200, MSG.TOO_LONG(200)),
  severity: z
    .enum(['mild', 'moderate', 'severe'])
    .optional()
    .default('moderate'),
  reaction: z.string().trim().max(500, MSG.TOO_LONG(500)).optional().nullable(),
  notes: z.string().trim().max(500, MSG.TOO_LONG(500)).optional().nullable(),
})

export type AllergyCreateInput = z.infer<typeof allergyCreateSchema>
