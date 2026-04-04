-- ================================================================
-- 019: Invoice Payments — Ödeme geçmişi + fatura genişletme
-- ================================================================

-- 1) Ödeme geçmişi tablosu
CREATE TABLE IF NOT EXISTS invoice_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('cash','card','transfer','online')),
  payment_type TEXT NOT NULL DEFAULT 'payment'
    CHECK (payment_type IN ('payment','deposit','installment','refund')),
  installment_number INTEGER,
  notes TEXT,
  staff_id UUID REFERENCES staff_members(id),
  staff_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2) RLS
ALTER TABLE invoice_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invoice_payments_select" ON invoice_payments
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

CREATE POLICY "invoice_payments_insert" ON invoice_payments
  FOR INSERT WITH CHECK (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

CREATE POLICY "invoice_payments_update" ON invoice_payments
  FOR UPDATE USING (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

CREATE POLICY "invoice_payments_delete" ON invoice_payments
  FOR DELETE USING (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

-- 3) Indexler
CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_business ON invoice_payments(business_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_created ON invoice_payments(created_at);

-- 4) invoices tablosuna yeni kolonlar
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pos_transaction_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS staff_id UUID;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS staff_name TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS payment_type TEXT DEFAULT 'standard';
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS installment_count INTEGER;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS installment_frequency TEXT;

-- 5) Mevcut ödendi faturalarının paid_amount'unu doldur
UPDATE invoices SET paid_amount = total WHERE status = 'paid' AND (paid_amount IS NULL OR paid_amount = 0);
