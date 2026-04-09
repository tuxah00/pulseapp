import { z } from 'zod'
import { MSG } from './messages'

/**
 * Randevu güncelleme şeması (PATCH — drag-drop dahil).
 *
 * businessId zorunlu (yetki kontrolü için kullanılıyor).
 * Diğer alanlar opsiyonel.
 */
export const appointmentPatchSchema = z.object({
  businessId: z.string().uuid(MSG.INVALID_UUID),
  appointment_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  status: z
    .enum(['pending', 'confirmed', 'completed', 'cancelled', 'no_show'])
    .optional(),
  staff_id: z.string().uuid(MSG.INVALID_UUID).optional(),
  notes: z.string().trim().max(1000, MSG.TOO_LONG(1000)).optional(),
})

export type AppointmentPatchInput = z.infer<typeof appointmentPatchSchema>
