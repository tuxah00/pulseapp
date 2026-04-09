import { z } from 'zod'
import { MSG } from './messages'

/**
 * İşletme kaydı oluşturma şeması.
 */
export const recordCreateSchema = z.object({
  type: z.string().trim().min(1, MSG.REQUIRED),
  title: z.string().trim().min(1, MSG.REQUIRED).max(300, MSG.TOO_LONG(300)),
  data: z.record(z.string(), z.unknown()).optional().default({}),
  customer_id: z.string().uuid(MSG.INVALID_UUID).optional().nullable(),
})

export type RecordCreateInput = z.infer<typeof recordCreateSchema>
