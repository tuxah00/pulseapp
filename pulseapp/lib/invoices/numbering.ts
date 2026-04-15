import type { SupabaseClient } from '@supabase/supabase-js'

/** Yıl bazlı sıralı sıra numarası üretir: {PREFIX}-{YIL}-XXXX */
async function generateYearSequence(
  supabase: SupabaseClient,
  table: string,
  column: string,
  prefix: string,
  businessId: string,
): Promise<string> {
  const year = new Date().getFullYear()
  const pattern = `${prefix}-${year}-%`
  const { data: last } = await supabase
    .from(table)
    .select(column)
    .eq('business_id', businessId)
    .like(column, pattern)
    .order(column, { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastValue = last && (last as unknown as Record<string, string | null>)[column]
  const lastSeq = lastValue
    ? parseInt(lastValue.split('-')[2]) || 0
    : 0
  return `${prefix}-${year}-${String(lastSeq + 1).padStart(4, '0')}`
}

/** Yıl bazlı sıralı fatura numarası üretir: INV-2026-0042 */
export function generateInvoiceNumber(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  return generateYearSequence(supabase, 'invoices', 'invoice_number', 'INV', businessId)
}

/** Yıl bazlı sıralı POS fiş numarası üretir: RCP-2026-0042 */
export function generateReceiptNumber(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  return generateYearSequence(supabase, 'pos_transactions', 'receipt_number', 'RCP', businessId)
}
