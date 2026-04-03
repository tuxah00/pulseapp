-- =============================================
-- 018: POS / Kasa Modülü
-- Kasa işlemleri ve oturum yönetimi
-- =============================================

-- ── pos_transactions ──

CREATE TABLE IF NOT EXISTS pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id),
  appointment_id UUID REFERENCES appointments(id),
  customer_id UUID REFERENCES customers(id),
  staff_id UUID REFERENCES staff_members(id),

  transaction_type TEXT NOT NULL DEFAULT 'sale'
    CHECK (transaction_type IN ('sale', 'refund', 'package_sale')),

  items JSONB NOT NULL DEFAULT '[]',

  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_type TEXT CHECK (discount_type IN ('percentage', 'fixed')),
  tax_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,

  payments JSONB NOT NULL DEFAULT '[]',
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid', 'partial', 'refunded')),

  receipt_number TEXT,
  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE pos_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_transactions_select" ON pos_transactions
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pos_transactions_insert" ON pos_transactions
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pos_transactions_update" ON pos_transactions
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pos_transactions_delete" ON pos_transactions
  FOR DELETE USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pos_transactions_business ON pos_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_created ON pos_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_customer ON pos_transactions(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pos_transactions_appointment ON pos_transactions(appointment_id) WHERE appointment_id IS NOT NULL;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_pos_transactions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pos_transactions_updated_at
  BEFORE UPDATE ON pos_transactions
  FOR EACH ROW
  EXECUTE FUNCTION update_pos_transactions_updated_at();


-- ── pos_sessions ──

CREATE TABLE IF NOT EXISTS pos_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id),

  opened_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,

  opening_cash NUMERIC(10,2) NOT NULL DEFAULT 0,

  total_cash NUMERIC(10,2) DEFAULT 0,
  total_card NUMERIC(10,2) DEFAULT 0,
  total_transfer NUMERIC(10,2) DEFAULT 0,
  total_sales NUMERIC(10,2) DEFAULT 0,
  total_refunds NUMERIC(10,2) DEFAULT 0,
  expected_cash NUMERIC(10,2) DEFAULT 0,
  actual_cash NUMERIC(10,2),
  difference NUMERIC(10,2),

  notes TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE pos_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pos_sessions_select" ON pos_sessions
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pos_sessions_insert" ON pos_sessions
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "pos_sessions_update" ON pos_sessions
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pos_sessions_business ON pos_sessions(business_id);
CREATE INDEX IF NOT EXISTS idx_pos_sessions_status ON pos_sessions(business_id, status) WHERE status = 'open';
