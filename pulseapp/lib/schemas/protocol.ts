import { z } from 'zod'
import { MSG } from './messages'

/**
 * Protokol oluşturma şeması.
 */
export const protocolCreateSchema = z.object({
  customerId: z.string().uuid(MSG.INVALID_UUID),
  name: z.string().trim().min(1, MSG.REQUIRED).max(200, MSG.TOO_LONG(200)),
  totalSessions: z
    .number({ message: MSG.INVALID_NUMBER })
    .int()
    .min(1, MSG.MIN_VALUE(1)),
  serviceId: z.string().uuid(MSG.INVALID_UUID).optional().nullable(),
  intervalDays: z
    .number({ message: MSG.INVALID_NUMBER })
    .int()
    .min(1, MSG.MIN_VALUE(1))
    .optional(),
  notes: z.string().trim().max(1000, MSG.TOO_LONG(1000)).optional().nullable(),
})

export type ProtocolCreateInput = z.infer<typeof protocolCreateSchema>

/**
 * Protokol seans güncelleme şeması.
 */
export const sessionPatchSchema = z.object({
  businessId: z.string().uuid(MSG.INVALID_UUID),
  sessionId: z.string().uuid(MSG.INVALID_UUID),
  status: z
    .enum(['planned', 'completed', 'skipped', 'cancelled'])
    .optional(),
  appointmentId: z.string().uuid(MSG.INVALID_UUID).optional(),
  notes: z.string().trim().max(1000, MSG.TOO_LONG(1000)).optional(),
  completedDate: z.string().optional(),
  beforePhotoUrl: z.string().url().optional(),
  afterPhotoUrl: z.string().url().optional(),
})

export type SessionPatchInput = z.infer<typeof sessionPatchSchema>
