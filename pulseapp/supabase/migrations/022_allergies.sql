-- =============================================
-- 022: Alerji & Kontrendikasyon Takibi
-- =============================================

-- Müşteri alerjileri
CREATE TABLE customer_allergies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'moderate'
    CHECK (severity IN ('mild','moderate','severe')),
  reaction TEXT,
  notes TEXT,
  reported_at DATE DEFAULT CURRENT_DATE,
  created_by UUID REFERENCES staff_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hizmet kontrendikasyonları (hangi alerjen hangi hizmetle uyumsuz)
CREATE TABLE service_contraindications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  risk_level TEXT NOT NULL DEFAULT 'high'
    CHECK (risk_level IN ('low','medium','high')),
  warning_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexler
CREATE INDEX idx_customer_allergies_business ON customer_allergies(business_id);
CREATE INDEX idx_customer_allergies_customer ON customer_allergies(customer_id);
CREATE INDEX idx_service_contraindications_business ON service_contraindications(business_id);
CREATE INDEX idx_service_contraindications_service ON service_contraindications(service_id);
CREATE INDEX idx_service_contraindications_allergen ON service_contraindications(business_id, allergen);

-- RLS
ALTER TABLE customer_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_contraindications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_allergies_business_access" ON customer_allergies
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "service_contraindications_business_access" ON service_contraindications
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );
