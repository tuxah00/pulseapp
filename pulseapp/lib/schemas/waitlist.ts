import { z } from 'zod'
import { MSG } from './messages'
import { phoneField } from './customer'

/**
 * Public waitlist endpoint (POST /api/public/business/[id]/waitlist) şeması.
 *
 * customerPhone '5XXXXXXXXX' formatına normalize edilir.
 * Route'ta '+90' prefix eklenerek DB'ye yazılır.
 */
export const waitlistCreateSchema = z.object({
  customerName: z
    .string()
    .trim()
    .min(2, MSG.TOO_SHORT(2))
    .max(100, MSG.TOO_LONG(100)),
  customerPhone: phoneField,
  serviceId: z.string().uuid(MSG.INVALID_UUID).optional(),
  staffId: z.string().uuid(MSG.INVALID_UUID).optional(),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT)
    .optional(),
  preferredTime: z
    .string()
    .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Geçersiz saat formatı')
    .optional(),
  autoBookOnMatch: z.boolean().optional(),
})

export type WaitlistCreateInput = z.infer<typeof waitlistCreateSchema>
