import { z } from 'zod'
import { MSG } from './messages'
import { phoneField } from './customer'
import { isValidCustomerBirthday } from '@/lib/utils/birthday'

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
    .number({ error: 'Puan sayı olmalı' })
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

// ---------------------------------------------------------------------------
// /api/portal/otp + /api/portal/direct-login — OTP isteme / atlamalı giriş
// ---------------------------------------------------------------------------

export const portalPhoneLookupSchema = z.object({
  businessId: UUID,
  phone: phoneField,
})

export type PortalPhoneLookupInput = z.infer<typeof portalPhoneLookupSchema>

// ---------------------------------------------------------------------------
// /api/portal/verify — OTP doğrulama
// ---------------------------------------------------------------------------

export const portalVerifySchema = z.object({
  businessId: UUID,
  phone: phoneField,
  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Geçersiz kod formatı'),
})

export type PortalVerifyInput = z.infer<typeof portalVerifySchema>

// ---------------------------------------------------------------------------
// /api/portal/appointments/[id] — randevu tarih/saat güncelleme
// ---------------------------------------------------------------------------

export const portalAppointmentUpdateSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT),
})

export type PortalAppointmentUpdateInput = z.infer<typeof portalAppointmentUpdateSchema>

// ---------------------------------------------------------------------------
// /api/portal/profile — müşteri profil güncelleme (PATCH)
// ---------------------------------------------------------------------------

export const portalChannelValues = ['sms', 'whatsapp', 'email', 'auto'] as const

export const portalProfileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, MSG.TOO_SHORT(2)).max(200, MSG.TOO_LONG(200)).optional(),
    email: z
      .union([
        z.string().trim().email(MSG.INVALID_EMAIL),
        z.literal('').transform(() => null),
        z.null(),
      ])
      .optional(),
    birthday: z
      .union([
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Doğum tarihi YYYY-AA-GG formatında olmalı')
          .refine(isValidCustomerBirthday, { message: MSG.BIRTHDAY_MIN_AGE }),
        z.literal('').transform(() => null),
        z.null(),
      ])
      .optional(),
    preferred_channel: z
      .union([z.enum(portalChannelValues), z.null()])
      .optional(),
  })
  .refine(
    (val) => Object.keys(val).length > 0,
    { message: 'Güncellenecek alan yok' },
  )

export type PortalProfileUpdateInput = z.infer<typeof portalProfileUpdateSchema>

// ---------------------------------------------------------------------------
// /api/portal/appointments — POST: müşteri portal'dan online randevu oluşturur
// ---------------------------------------------------------------------------

export const portalAppointmentCreateSchema = z.object({
  serviceId: UUID,
  staffId: UUID.optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, MSG.INVALID_DATE_FORMAT),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, MSG.INVALID_TIME_FORMAT),
  notes: z
    .string()
    .trim()
    .max(500, MSG.TOO_LONG(500))
    .optional()
    .or(z.literal('').transform(() => undefined)),
  /** Paket seansından randevu alındığında bu paketin ID'si (seans düşümü için) */
  packageId: UUID.optional().nullable(),
})

export type PortalAppointmentCreateInput = z.infer<typeof portalAppointmentCreateSchema>

// ---------------------------------------------------------------------------
// /api/portal/messages — POST: müşteri inbound mesaj gönderir (web channel)
// ---------------------------------------------------------------------------

export const portalMessageCreateSchema = z.object({
  content: z.string().trim().min(1, MSG.REQUIRED).max(2000, MSG.TOO_LONG(2000)),
})

export type PortalMessageCreateInput = z.infer<typeof portalMessageCreateSchema>

// ---------------------------------------------------------------------------
// /api/portal/consents/revoke — POST: müşteri rızasını iptal eder
// ---------------------------------------------------------------------------

export const portalConsentRevokeSchema = z.object({
  consentId: UUID,
})

export type PortalConsentRevokeInput = z.infer<typeof portalConsentRevokeSchema>
