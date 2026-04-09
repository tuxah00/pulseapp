import { z } from 'zod'
import { MSG } from './messages'

/**
 * Gider oluşturma şeması.
 */
export const expenseCreateSchema = z.object({
  business_id: z.string().uuid(MSG.INVALID_UUID),
  category: z.string().trim().min(1, MSG.REQUIRED),
  amount: z
    .number({ message: MSG.INVALID_NUMBER })
    .positive(MSG.POSITIVE_NUMBER),
  expense_date: z.string().min(1, MSG.REQUIRED),
  description: z.string().trim().max(500, MSG.TOO_LONG(500)).optional().nullable(),
  is_recurring: z.boolean().optional(),
  recurring_period: z.string().optional().nullable(),
  custom_interval_days: z.number().int().min(1, MSG.MIN_VALUE(1)).optional().nullable(),
})

export type ExpenseCreateInput = z.infer<typeof expenseCreateSchema>

/**
 * Gelir oluşturma şeması.
 */
export const incomeCreateSchema = z.object({
  business_id: z.string().uuid(MSG.INVALID_UUID),
  category: z.string().trim().min(1, MSG.REQUIRED),
  amount: z
    .number({ message: MSG.INVALID_NUMBER })
    .positive(MSG.POSITIVE_NUMBER),
  income_date: z.string().min(1, MSG.REQUIRED),
  description: z.string().trim().max(500, MSG.TOO_LONG(500)).optional().nullable(),
  is_recurring: z.boolean().optional(),
  recurring_period: z.string().optional().nullable(),
  custom_interval_days: z.number().int().min(1, MSG.MIN_VALUE(1)).optional().nullable(),
})

export type IncomeCreateInput = z.infer<typeof incomeCreateSchema>
