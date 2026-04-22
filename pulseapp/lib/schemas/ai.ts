import { z } from 'zod'
import { MSG } from './messages'

/**
 * AI endpoint'leri için Zod şemaları.
 *
 * validateBody() ile kullanılır; hata mesajları Türkçe.
 */

const UUID = z.string().uuid(MSG.INVALID_UUID)

// ---------------------------------------------------------------------------
// /api/ai/assistant — ana sohbet (POST)
// ---------------------------------------------------------------------------

export const aiAssistantBodySchema = z.object({
  conversationId: UUID.nullable().optional(),
  message: z.string().trim().min(1, 'Mesaj boş olamaz').max(8000, MSG.TOO_LONG(8000)),
  isOnboarding: z.boolean().optional(),
  origin: z.string().trim().max(200).optional(),
  tutorialTopic: z.string().trim().max(200).optional(),
})

export type AiAssistantBodyInput = z.infer<typeof aiAssistantBodySchema>

// ---------------------------------------------------------------------------
// /api/ai/assistant/conversations — sohbet oluşturma (POST)
// ---------------------------------------------------------------------------

export const aiConversationCreateSchema = z.object({
  title: z.string().trim().max(200, MSG.TOO_LONG(200)).optional(),
  isOnboarding: z.boolean().optional(),
})

export type AiConversationCreateInput = z.infer<typeof aiConversationCreateSchema>

// ---------------------------------------------------------------------------
// /api/ai/assistant/confirm — aksiyon onay/iptal (POST)
// ---------------------------------------------------------------------------

export const aiActionConfirmSchema = z.object({
  action_id: UUID,
  decision: z.enum(['confirm', 'cancel'], {
    error: "decision 'confirm' veya 'cancel' olmalı",
  }),
})

export type AiActionConfirmInput = z.infer<typeof aiActionConfirmSchema>

// ---------------------------------------------------------------------------
// /api/ai/before-after — öncesi/sonrası fotoğraf analizi (POST)
// ---------------------------------------------------------------------------

export const aiBeforeAfterSchema = z.object({
  beforeUrl: z.string().trim().url('Geçerli bir URL girin (beforeUrl)'),
  afterUrl: z.string().trim().url('Geçerli bir URL girin (afterUrl)'),
  customerId: UUID.optional().nullable(),
  protocolId: UUID.optional().nullable(),
})

export type AiBeforeAfterInput = z.infer<typeof aiBeforeAfterSchema>

// ---------------------------------------------------------------------------
// /api/ai/photo-analysis — tek fotoğraf analizi (POST)
// ---------------------------------------------------------------------------

export const aiPhotoAnalysisSchema = z.object({
  imageUrl: z.string().trim().url('Geçerli bir URL girin (imageUrl)'),
  title: z.string().trim().max(200, MSG.TOO_LONG(200)).optional().nullable(),
  category: z.string().trim().max(100, MSG.TOO_LONG(100)).optional().nullable(),
})

export type AiPhotoAnalysisInput = z.infer<typeof aiPhotoAnalysisSchema>

// ---------------------------------------------------------------------------
// /api/ai/tutorial-progress — öğretici ilerleme güncelleme (PATCH)
// ---------------------------------------------------------------------------

const isoDatetimeOrNull = z
  .string()
  .datetime({ offset: true, message: 'ISO 8601 tarih formatı bekleniyor' })
  .nullable()
  .optional()

export const aiTutorialProgressSchema = z
  .object({
    enabled: z.boolean().optional(),
    setup_completed_at: isoDatetimeOrNull,
    dismissed_at: isoDatetimeOrNull,
    seen_pages: z.array(z.string().trim().max(200)).max(200).optional(),
    resetSeen: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.enabled !== undefined ||
      v.setup_completed_at !== undefined ||
      v.dismissed_at !== undefined ||
      v.seen_pages !== undefined ||
      v.resetSeen !== undefined,
    { message: 'En az bir alan güncellenmeli' },
  )

export type AiTutorialProgressInput = z.infer<typeof aiTutorialProgressSchema>
