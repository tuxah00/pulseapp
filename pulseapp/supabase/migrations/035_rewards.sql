-- =============================================
-- 035: Ödül Şablonları & Müşteri Ödülleri
-- =============================================

-- Ödül şablonları
CREATE TABLE IF NOT EXISTS rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('discount_percent','discount_amount','free_service','points','gift')),
  value NUMERIC(10,2),
  description TEXT,
  valid_days INTEGER DEFAULT 30,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Müşteriye atanmış ödüller
CREATE TABLE IF NOT EXISTS customer_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  reward_id UUID NOT NULL REFERENCES rewards(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','used','expired')),
  given_at TIMESTAMPTZ DEFAULT now(),
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  notes TEXT
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_rewards_business ON rewards(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_business ON customer_rewards(business_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_customer ON customer_rewards(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_reward ON customer_rewards(reward_id);
CREATE INDEX IF NOT EXISTS idx_customer_rewards_status ON customer_rewards(business_id, status);

-- RLS
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rewards_business_access" ON rewards
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "customer_rewards_business_access" ON customer_rewards
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- referrals tablosunda reward_type constraint'ini güncelle (gift ekle)
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_reward_type_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_reward_type_check
  CHECK (reward_type IN ('discount_percent','discount_amount','free_service','points','gift'));

-- referrals tablosunda status constraint'ini güncelle (rewarded ekle)
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check
  CHECK (status IN ('pending','converted','expired','rewarded'));
