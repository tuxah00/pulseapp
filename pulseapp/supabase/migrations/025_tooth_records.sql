-- Diş Haritası tablosu
CREATE TABLE IF NOT EXISTS tooth_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  tooth_number INTEGER NOT NULL CHECK (tooth_number BETWEEN 11 AND 48),
  condition TEXT NOT NULL DEFAULT 'healthy'
    CHECK (condition IN ('healthy','caries','filled','crown','extracted','implant','root_canal','bridge','missing')),
  treatment TEXT,
  notes TEXT,
  treated_at DATE,
  treated_by_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE (business_id, customer_id, tooth_number)
);

-- RLS
ALTER TABLE tooth_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tooth_records_business_isolation" ON tooth_records
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_tooth_records_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER tooth_records_updated_at
  BEFORE UPDATE ON tooth_records
  FOR EACH ROW EXECUTE FUNCTION update_tooth_records_updated_at();

-- İndeks
CREATE INDEX IF NOT EXISTS idx_tooth_records_customer ON tooth_records (business_id, customer_id);
