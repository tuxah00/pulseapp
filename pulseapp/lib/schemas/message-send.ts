import { z } from 'zod'
import { MSG } from './messages'
import { WA_TEMPLATE_TYPES } from '@/lib/whatsapp/templates'

/**
 * /api/messages/send — mesaj gönderme (POST)
 *
 * Template mesajlar için `templateName` + `templateParams` alanları opsiyonel olarak geçilir.
 */

export const messageSendSchema = z.object({
  customerId: z.string().uuid(MSG.INVALID_UUID),
  content: z.string().trim().min(1, MSG.REQUIRED).max(4000, MSG.TOO_LONG(4000)),
  messageType: z.enum(['text', 'template', 'ai_generated', 'system']).optional(),
  channel: z.enum(['sms', 'whatsapp', 'web', 'auto']).optional(),
  templateName: z.enum(WA_TEMPLATE_TYPES).optional(),
  templateParams: z.record(z.string(), z.string()).optional(),
})

export type MessageSendInput = z.infer<typeof messageSendSchema>
