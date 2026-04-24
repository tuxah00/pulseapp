-- Müşteri portal'dan "havale yaptım" bildirimi tutan tablo.
-- Pilot modunda PayTR yok; müşteri portalden ödediğini iletir, personel onaylayınca
-- invoice.status = 'paid' güncellenir. Onaysız durumda 'pending' kalır.

CREATE TABLE IF NOT EXISTS invoice_payment_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payment_date DATE,
  payment_method TEXT,                       -- 'havale' | 'nakit' | 'kart_terminali' | 'diger'
  iban_last4 TEXT,
  amount NUMERIC(12,2),
  note TEXT,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | confirmed | rejected
  reviewed_by UUID,                          -- staff_members.id
  reviewed_at TIMESTAMPTZ,
  review_note TEXT
);

CREATE INDEX IF NOT EXISTS idx_payment_claims_invoice ON invoice_payment_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payment_claims_business_status
  ON invoice_payment_claims(business_id, status, claimed_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_claims_customer ON invoice_payment_claims(customer_id);

ALTER TABLE invoice_payment_claims ENABLE ROW LEVEL SECURITY;

-- Aynı işletmeden olan staff okuyabilir + güncelleyebilir (review)
DROP POLICY IF EXISTS "claims staff read" ON invoice_payment_claims;
CREATE POLICY "claims staff read" ON invoice_payment_claims
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

DROP POLICY IF EXISTS "claims staff update" ON invoice_payment_claims;
CREATE POLICY "claims staff update" ON invoice_payment_claims
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM staff_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Müşteri portal cookie tabanlı çalışıyor (RLS auth.uid() yok); insert için
-- portal endpoint admin client kullanır → service_role policy bypass eder.
