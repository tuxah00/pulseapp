-- ============================================
-- 035: Ödüller (Rewards) Sistemi
-- ============================================

-- Ödül şablonları (işletme tanımlı)
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount_percent', 'discount_fixed', 'free_service', 'points', 'gift')),
  value NUMERIC,
  description TEXT,
  valid_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Müşteriye atanmış ödüller
CREATE TABLE IF NOT EXISTS customer_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'used', 'expired')),
  given_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_rewards_business ON rewards(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_business ON customer_rewards(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_customer ON customer_rewards(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_status ON customer_rewards(status);

-- RLS
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards_select" ON rewards FOR SELECT
  USING (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "rewards_insert" ON rewards FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "rewards_update" ON rewards FOR UPDATE
  USING (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "rewards_delete" ON rewards FOR DELETE
  USING (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "customer_rewards_select" ON customer_rewards FOR SELECT
  USING (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "customer_rewards_insert" ON customer_rewards FOR INSERT
  WITH CHECK (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "customer_rewards_update" ON customer_rewards FOR UPDATE
  USING (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));

CREATE POLICY "customer_rewards_delete" ON customer_rewards FOR DELETE
  USING (business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true));
