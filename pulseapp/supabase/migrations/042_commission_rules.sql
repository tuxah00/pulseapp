-- ============================================================
-- Migration 042: Prim & Komisyon Kuralları
-- commission_rules ve commission_earnings tabloları
-- ============================================================

-- Komisyon kuralları tablosu
CREATE TABLE IF NOT EXISTS commission_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id) ON DELETE CASCADE,
  rate_percent NUMERIC(5,2),
  rate_fixed NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_commission_rules_business_id ON commission_rules(business_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_staff_id ON commission_rules(staff_id);
CREATE INDEX IF NOT EXISTS idx_commission_rules_service_id ON commission_rules(service_id);

ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_rules_service_role" ON commission_rules
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "commission_rules_staff_select" ON commission_rules
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "commission_rules_staff_insert" ON commission_rules
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "commission_rules_staff_delete" ON commission_rules
  FOR DELETE USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Komisyon kazanç özeti tablosu
CREATE TABLE IF NOT EXISTS commission_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  appointment_count INTEGER DEFAULT 0,
  total_revenue NUMERIC(10,2) DEFAULT 0,
  commission_total NUMERIC(10,2) DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (business_id, staff_id, period)
);

CREATE INDEX IF NOT EXISTS idx_commission_earnings_business_id ON commission_earnings(business_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_staff_id ON commission_earnings(staff_id);
CREATE INDEX IF NOT EXISTS idx_commission_earnings_period ON commission_earnings(period);

ALTER TABLE commission_earnings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "commission_earnings_service_role" ON commission_earnings
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "commission_earnings_staff_select" ON commission_earnings
  FOR SELECT USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "commission_earnings_staff_insert" ON commission_earnings
  FOR INSERT WITH CHECK (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "commission_earnings_staff_update" ON commission_earnings
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE POLICY "commission_earnings_staff_delete" ON commission_earnings
  FOR DELETE USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );
