import { z } from 'zod'
import { MSG } from './messages'
import { phoneField } from './customer'

/**
 * Public + portal endpoint'leri için Zod şemaları.
 *
 * Hepsi `validateBody()` helper'ı ile kullanılır. Hata mesajları Türkçe.
 * Route'a gelen ham body'yi validate eder; dönen `parsed.data` tiplenmiş ve trim'lenmiş halidir.
 */

const UUID = z.string().uuid(MSG.INVALID_UUID)

// ---------------------------------------------------------------------------
// /api/feedback — işletme panelinden geri bildirim yönetimi (PATCH)
// ---------------------------------------------------------------------------

export const feedbackStatusValues = ['open', 'in_progress', 'resolved', 'closed'] as const
export type FeedbackStatus = (typeof feedbackStatusValues)[number]

/**
 * PATCH /api/feedback — yanıt yaz veya durum güncelle.
 * En az `response` veya `status` dolu olmalı; superRefine ile kontrol.
 */
export const feedbackPatchSchema = z
  .object({
    businessId: UUID,
    id: UUID,
    response: z.string().trim().min(1, MSG.REQUIRED).max(4000, MSG.TOO_LONG(4000)).optional(),
    status: z.enum(feedbackStatusValues).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.response === undefined && val.status === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['response'],
        message: 'response veya status zorunludur',
      })
    }
  })

export type FeedbackPatchInput = z.infer<typeof feedbackPatchSchema>

// ---------------------------------------------------------------------------
// /api/consent — rıza kaydı (public; auth yok, KVKK onayı)
// ---------------------------------------------------------------------------

export const consentTypeValues = ['kvkk', 'marketing', 'health_data', 'whatsapp'] as const
export const consentMethodValues = ['online_form', 'in_person', 'phone', 'whatsapp'] as const

export const consentCreateSchema = z.object({
  businessId: UUID,
  customerId: UUID.optional().nullable(),
  customerPhone: phoneField.optional(),
  consentType: z.enum(consentTypeValues),
  method: z.enum(consentMethodValues),
  ipAddress: z.string().trim().max(100, MSG.TOO_LONG(100)).optional().nullable(),
  notes: z.string().trim().max(1000, MSG.TOO_LONG(1000)).optional().nullable(),
})

export type ConsentCreateInput = z.infer<typeof consentCreateSchema>

/**
 * DELETE /api/consent — veri silme/anonimleştirme talebi.
 */
export const consentDeletionRequestSchema = z.object({
  businessId: UUID,
  customerId: UUID.optional().nullable(),
  customerName: z.string().trim().max(200, MSG.TOO_LONG(200)).optional().nullable(),
  customerPhone: phoneField.optional(),
  notes: z.string().trim().max(2000, MSG.TOO_LONG(2000)).optional().nullable(),
})

export type ConsentDeletionRequestInput = z.infer<typeof consentDeletionRequestSchema>

// ---------------------------------------------------------------------------
// /api/portal/data-deletion — müşterinin kendi verisini silme talebi
// ---------------------------------------------------------------------------

export const dataDeletionReasonValues = [
  'not_using',
  'privacy_concern',
  'switched_provider',
  'dissatisfied',
  'other',
] as const

export const portalDataDeletionSchema = z.object({
  reasonCategory: z.enum(dataDeletionReasonValues).optional().nullable(),
  reason: z.string().trim().max(2000, MSG.TOO_LONG(2000)).optional().nullable(),
  confirmation: z
    .string()
    .trim()
    .refine((v) => v === 'VERİLERİMİ SİL', {
      message: 'Onay metnini doğru yazmalısın',
    }),
})

export type PortalDataDeletionInput = z.infer<typeof portalDataDeletionSchema>

// ---------------------------------------------------------------------------
// /api/portal/feedback — müşteri geri bildirim gönderimi
// ---------------------------------------------------------------------------

export const feedbackTypeValues = ['suggestion', 'complaint', 'praise', 'question'] as const

export const portalFeedbackCreateSchema = z.object({
  type: z.enum(feedbackTypeValues),
  subject: z
    .string()
    .trim()
    .max(200, MSG.TOO_LONG(200))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  message: z
    .string()
    .trim()
    .min(5, MSG.TOO_SHORT(5))
    .max(4000, MSG.TOO_LONG(4000)),
})

export type PortalFeedbackCreateInput = z.infer<typeof portalFeedbackCreateSchema>

// ---------------------------------------------------------------------------
// /api/portal/reviews — müşteri yorum gönderimi
// ---------------------------------------------------------------------------

export const portalReviewCreateSchema = z.object({
  appointmentId: UUID.optional().nullable(),
  rating: z
    .number({ invalid_type_error: 'Puan sayı olmalı' })
    .int('Puan tam sayı olmalı')
    .min(1, 'En az 1 puan verilmeli')
    .max(5, 'En fazla 5 puan verilebilir'),
  comment: z
    .string()
    .trim()
    .max(2000, MSG.TOO_LONG(2000))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  isAnonymous: z.boolean().optional(),
})

export type PortalReviewCreateInput = z.infer<typeof portalReviewCreateSchema>
