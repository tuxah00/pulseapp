-- Sadakat Puan Sistemi
-- Her müşteri için işletme bazında puan bakiyesi + seviye; her puan hareketi ayrı kayıt

CREATE TABLE IF NOT EXISTS loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  points_balance INTEGER NOT NULL DEFAULT 0,
  tier TEXT NOT NULL DEFAULT 'bronze' CHECK (tier IN ('bronze', 'silver', 'gold')),
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id)
);

CREATE TABLE IF NOT EXISTS point_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'expire', 'adjust')),
  points INTEGER NOT NULL,
  source TEXT NOT NULL DEFAULT 'appointment' CHECK (source IN ('appointment', 'visit_bonus', 'campaign', 'manual', 'redemption')),
  reference_id UUID,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_points_business_id ON loyalty_points(business_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_customer_id ON loyalty_points(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_business_id ON point_transactions(business_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_customer_id ON point_transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_point_transactions_reference_id ON point_transactions(reference_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_loyalty_points_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER loyalty_points_updated_at
  BEFORE UPDATE ON loyalty_points
  FOR EACH ROW EXECUTE FUNCTION update_loyalty_points_updated_at();

ALTER TABLE loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "loyalty_points_service_role" ON loyalty_points
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "loyalty_points_staff_all" ON loyalty_points
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      WHERE sm.business_id = loyalty_points.business_id
        AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "point_transactions_service_role" ON point_transactions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "point_transactions_staff_all" ON point_transactions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      WHERE sm.business_id = point_transactions.business_id
        AND sm.user_id = auth.uid()
    )
  );
