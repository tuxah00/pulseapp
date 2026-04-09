import { z } from 'zod'
import { MSG } from './messages'

/**
 * Fatura kalemi şeması.
 */
const invoiceItemSchema = z.object({
  service_name: z.string().trim().min(1, MSG.REQUIRED),
  quantity: z.number({ message: MSG.INVALID_NUMBER }).min(1, MSG.MIN_VALUE(1)),
  unit_price: z.number({ message: MSG.INVALID_NUMBER }).min(0, MSG.NON_NEGATIVE),
  total: z.number({ message: MSG.INVALID_NUMBER }).min(0, MSG.NON_NEGATIVE),
  product_id: z.string().uuid(MSG.INVALID_UUID).optional(),
  type: z.string().optional(),
})

/**
 * Fatura oluşturma şeması.
 */
export const invoiceCreateSchema = z.object({
  items: z
    .array(invoiceItemSchema)
    .min(1, MSG.MIN_ITEMS(1)),
  customer_id: z.string().uuid(MSG.INVALID_UUID).optional().nullable(),
  appointment_id: z.string().uuid(MSG.INVALID_UUID).optional().nullable(),
  tax_rate: z
    .number({ message: MSG.INVALID_NUMBER })
    .min(0, MSG.NON_NEGATIVE)
    .default(0),
  payment_method: z.string().optional().nullable(),
  notes: z.string().trim().max(1000, MSG.TOO_LONG(1000)).optional().nullable(),
  due_date: z.string().optional().nullable(),
  staff_name: z.string().optional().nullable(),
  payment_type: z
    .enum(['standard', 'deposit', 'installment'])
    .default('standard'),
  installment_count: z.number().int().min(1, MSG.MIN_VALUE(1)).optional().nullable(),
  installment_frequency: z.string().optional().nullable(),
  deposit_amount: z.number().min(0, MSG.NON_NEGATIVE).optional().nullable(),
})

export type InvoiceCreateInput = z.infer<typeof invoiceCreateSchema>

/**
 * Fatura güncelleme şeması (PATCH).
 *
 * Durum, ödeme yöntemi, notlar, vade tarihi, ödenen tutar güncellenebilir.
 */
export const invoicePatchSchema = z.object({
  status: z
    .enum(['pending', 'paid', 'partial', 'overdue', 'cancelled'])
    .optional(),
  payment_method: z.string().optional(),
  notes: z.string().trim().max(1000, MSG.TOO_LONG(1000)).optional(),
  due_date: z.string().optional(),
  paid_amount: z.number().min(0, MSG.NON_NEGATIVE).optional(),
  staff_id: z.string().uuid(MSG.INVALID_UUID).optional().nullable(),
  staff_name: z.string().optional().nullable(),
})

export type InvoicePatchInput = z.infer<typeof invoicePatchSchema>
