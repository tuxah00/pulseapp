-- 064_invoice_stock_tracking.sql
-- Fatura stok düşümü idempotency için stock_deducted_at kolonu
-- İade sonrası yeniden ödeme → çift stok düşümü engeli

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS stock_deducted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_invoices_stock_deducted
  ON invoices(id) WHERE stock_deducted_at IS NOT NULL;
