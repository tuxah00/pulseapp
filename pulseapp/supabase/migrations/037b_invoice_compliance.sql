-- 037: Fatura Türkiye uyumluluk + indirim + müşteri vergi bilgileri
-- Tarih: 2026-04-11

-- Müşterilere vergi bilgileri
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_id_type TEXT
  CHECK (tax_id_type IN ('vkn', 'tckn'));
ALTER TABLE customers ADD COLUMN IF NOT EXISTS tax_office TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS company_name TEXT;

-- Faturalara indirim desteği
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_type TEXT
  CHECK (discount_type IN ('percentage', 'fixed'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_description TEXT;

-- Faturalara müşteri vergi bilgileri (snapshot — müşteri güncellenirse bile fatura değişmez)
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_tax_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_tax_office TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_company_name TEXT;

-- Vadesi geçmiş fatura tespiti için index
CREATE INDEX IF NOT EXISTS idx_invoices_overdue_check
  ON invoices(due_date, status)
  WHERE due_date IS NOT NULL AND status IN ('pending', 'partial') AND deleted_at IS NULL;
