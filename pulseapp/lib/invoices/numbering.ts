import type { SupabaseClient } from '@supabase/supabase-js'

/** Yıl bazlı sıralı fatura numarası üretir: INV-2026-0042 */
export async function generateInvoiceNumber(
  supabase: SupabaseClient,
  businessId: string,
): Promise<string> {
  const year = new Date().getFullYear()
  const { data: last } = await supabase
    .from('invoices')
    .select('invoice_number')
    .eq('business_id', businessId)
    .like('invoice_number', `INV-${year}-%`)
    .order('invoice_number', { ascending: false })
    .limit(1)
    .maybeSingle()

  const lastSeq = last?.invoice_number
    ? parseInt(last.invoice_number.split('-')[2]) || 0
    : 0
  return `INV-${year}-${String(lastSeq + 1).padStart(4, '0')}`
}
