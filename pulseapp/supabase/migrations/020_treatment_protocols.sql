-- =============================================
-- 020: Tedavi Protokolü & Seans Takibi
-- =============================================

-- Tedavi protokolleri (örn: 6 seans lazer epilasyon)
CREATE TABLE treatment_protocols (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id UUID REFERENCES services(id),
  name TEXT NOT NULL,
  total_sessions INTEGER NOT NULL DEFAULT 1,
  completed_sessions INTEGER NOT NULL DEFAULT 0,
  interval_days INTEGER DEFAULT 14,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','completed','cancelled','paused')),
  notes TEXT,
  created_by UUID REFERENCES staff_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Protokol seansları (her seans ayrı satır)
CREATE TABLE protocol_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  protocol_id UUID NOT NULL REFERENCES treatment_protocols(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  session_number INTEGER NOT NULL,
  appointment_id UUID REFERENCES appointments(id),
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','completed','cancelled','skipped')),
  planned_date DATE,
  completed_date DATE,
  notes TEXT,
  before_photo_url TEXT,
  after_photo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexler
CREATE INDEX idx_treatment_protocols_business ON treatment_protocols(business_id);
CREATE INDEX idx_treatment_protocols_customer ON treatment_protocols(customer_id);
CREATE INDEX idx_treatment_protocols_status ON treatment_protocols(business_id, status);
CREATE INDEX idx_protocol_sessions_protocol ON protocol_sessions(protocol_id);
CREATE INDEX idx_protocol_sessions_business ON protocol_sessions(business_id);
CREATE INDEX idx_protocol_sessions_appointment ON protocol_sessions(appointment_id);

-- RLS
ALTER TABLE treatment_protocols ENABLE ROW LEVEL SECURITY;
ALTER TABLE protocol_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treatment_protocols_business_access" ON treatment_protocols
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "protocol_sessions_business_access" ON protocol_sessions
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_treatment_protocol_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_treatment_protocol_updated
  BEFORE UPDATE ON treatment_protocols
  FOR EACH ROW EXECUTE FUNCTION update_treatment_protocol_timestamp();
