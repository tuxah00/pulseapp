-- Migration 029: Faturalama altyapısı

-- businesses tablosuna billing alanları ekle
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS tax_office TEXT,
  ADD COLUMN IF NOT EXISTS tax_number TEXT,
  ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;

-- Ödemeler tablosu (PayTR işlemleri)
CREATE TABLE IF NOT EXISTS payments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  merchant_oid  TEXT UNIQUE NOT NULL,
  plan_type     TEXT NOT NULL CHECK (plan_type IN ('starter', 'standard', 'pro')),
  amount        NUMERIC(10,2) NOT NULL,
  currency      TEXT DEFAULT 'TRY',
  status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
  paytr_response JSONB,
  paid_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- invoices tablosuna e-fatura alanları ekle
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS efatura_id TEXT,
  ADD COLUMN IF NOT EXISTS efatura_status TEXT,
  ADD COLUMN IF NOT EXISTS efatura_pdf_url TEXT;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_payments_business ON payments (business_id, status);
CREATE INDEX IF NOT EXISTS idx_payments_oid ON payments (merchant_oid);
CREATE INDEX IF NOT EXISTS idx_invoices_efatura ON invoices (efatura_id) WHERE efatura_id IS NOT NULL;

-- RLS
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "payments_select" ON payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = payments.business_id
        AND staff_members.is_active = true
    )
  );
