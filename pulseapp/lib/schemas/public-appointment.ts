import { z } from 'zod'
import { MSG } from './messages'

/**
 * Public appointment PATCH (tarih/saat değiştirme) şeması.
 */
export const publicAppointmentPatchSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT),
})

export type PublicAppointmentPatchInput = z.infer<typeof publicAppointmentPatchSchema>

/**
 * Public appointment DELETE (iptal nedeni) şeması.
 */
export const publicAppointmentDeleteSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(500, MSG.TOO_LONG(500))
    .optional(),
})

export type PublicAppointmentDeleteInput = z.infer<typeof publicAppointmentDeleteSchema>
