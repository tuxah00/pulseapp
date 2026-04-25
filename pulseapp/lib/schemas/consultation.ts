// lib/schemas/consultation.ts
// Ön Konsültasyon Zod şemaları

import { z } from 'zod'

export const consultationConsentSchema = z.object({
  kvkk: z.boolean(),
  healthData: z.boolean(),
  marketing: z.boolean(),
})

export const consultationInitSchema = z.object({
  businessId: z.string().uuid(),
  fullName: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  website: z.string().max(0).optional(), // honeypot — boş olmalı
})

export const consultationCreateSchema = z.object({
  tempToken: z.string().min(1),
  businessId: z.string().uuid(),
  fullName: z.string().min(2).max(100),
  phone: z.string().min(7).max(20),
  email: z.string().email().optional().nullable(),
  age: z.number().int().min(0).max(120).optional().nullable(),
  serviceId: z.string().uuid().optional().nullable(),
  serviceLabel: z.string().max(200).optional().nullable(),
  question: z.string().min(10).max(3000),
  healthNotes: z.string().max(2000).optional().nullable(),
  photoUrls: z.array(z.object({
    url: z.string().url(),
    path: z.string().min(1),
  })).max(5),
  consents: consultationConsentSchema,
  website: z.string().max(0).optional(), // honeypot
})

export const consultationUpdateSchema = z.object({
  status: z.enum(['pending','reviewing','suitable','not_suitable','needs_more_info','converted','archived']).optional(),
  decisionReason: z.string().max(2000).optional().nullable(),
})

export const consultationRespondSchema = z.object({
  message: z.string().min(1).max(3000),
  channel: z.enum(['auto','whatsapp','sms']).default('auto'),
  updateStatus: z.enum(['pending','reviewing','suitable','not_suitable','needs_more_info','converted','archived']).optional(),
  decisionReason: z.string().max(2000).optional().nullable(),
})

export const consultationConvertSchema = z.object({
  serviceId: z.string().uuid(),
  staffId: z.string().uuid().optional().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  notes: z.string().max(2000).optional().nullable(),
})
