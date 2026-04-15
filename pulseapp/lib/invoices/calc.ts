const round2 = (n: number): number => Math.round(n * 100) / 100

export interface InvoiceTotalsInput {
  subtotal: number
  tax_rate?: number | null
  discount_amount?: number | null
  discount_type?: 'percentage' | 'fixed' | null
}

export interface InvoiceTotals {
  subtotal: number
  discount_value: number
  taxable_amount: number
  tax_amount: number
  total: number
}

/** Fatura ara toplam, indirim, KDV ve toplam tutarları tutarlı şekilde hesaplar */
export function computeInvoiceTotals(input: InvoiceTotalsInput): InvoiceTotals {
  const subtotal = round2(input.subtotal)
  const discountInput = input.discount_amount || 0
  const discount_value = input.discount_type === 'percentage'
    ? round2(subtotal * discountInput / 100)
    : round2(discountInput)
  const taxable_amount = round2(subtotal - discount_value)
  const tax_rate = input.tax_rate || 0
  const tax_amount = round2(taxable_amount * tax_rate / 100)
  const total = round2(taxable_amount + tax_amount)
  return { subtotal, discount_value, taxable_amount, tax_amount, total }
}
