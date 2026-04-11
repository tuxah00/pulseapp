import { z } from 'zod'
import { MSG } from './messages'

/**
 * Üyelik oluşturma şeması.
 */
export const membershipCreateSchema = z.object({
  business_id: z.string().uuid(MSG.INVALID_UUID),
  customer_name: z
    .string()
    .trim()
    .min(2, MSG.TOO_SHORT(2))
    .max(100, MSG.TOO_LONG(100)),
  customer_phone: z.string().trim().optional().nullable(),
  plan_name: z
    .string()
    .trim()
    .min(1, MSG.REQUIRED)
    .max(200, MSG.TOO_LONG(200)),
  start_date: z.string().min(1, MSG.REQUIRED),
  end_date: z.string().optional().nullable(),
  price: z.number().min(0, MSG.NON_NEGATIVE).optional().nullable(),
  sessions_total: z
    .number()
    .int()
    .min(0, MSG.NON_NEGATIVE)
    .optional()
    .nullable(),
  sessions_used: z
    .number()
    .int()
    .min(0, MSG.NON_NEGATIVE)
    .default(0),
  status: z
    .enum(['active', 'expired', 'frozen', 'cancelled'])
    .default('active'),
  notes: z
    .string()
    .trim()
    .max(500, MSG.TOO_LONG(500))
    .optional()
    .nullable(),
})

export type MembershipCreateInput = z.infer<typeof membershipCreateSchema>

/**
 * Üyelik güncelleme şeması — business_id hariç tüm alanlar opsiyonel.
 */
export const membershipPatchSchema = membershipCreateSchema
  .omit({ business_id: true })
  .partial()

export type MembershipPatchInput = z.infer<typeof membershipPatchSchema>
