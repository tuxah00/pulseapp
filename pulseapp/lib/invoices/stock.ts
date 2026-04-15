import type { SupabaseClient } from '@supabase/supabase-js'
import type { InvoiceItem } from '@/types'

/** Fatura kalemlerindeki ürünleri stoktan düşer + stock_movements kaydı oluşturur */
export async function deductStockFromItems(
  supabase: SupabaseClient,
  items: InvoiceItem[],
  ctx: { businessId: string; invoiceNumber: string; userId?: string | null },
): Promise<void> {
  for (const item of items) {
    if (!item.product_id || item.type !== 'product') continue
    const { data: product } = await supabase
      .from('products')
      .select('stock_quantity')
      .eq('id', item.product_id)
      .single()
    if (!product) continue

    const newQty = Math.max(0, (product.stock_quantity || 0) - item.quantity)
    await supabase
      .from('products')
      .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
      .eq('id', item.product_id)

    await supabase.from('stock_movements').insert({
      business_id: ctx.businessId,
      product_id: item.product_id,
      type: 'out',
      quantity: item.quantity,
      notes: `Fatura ${ctx.invoiceNumber} ile satış`,
      created_by: ctx.userId || null,
    })
  }
}
