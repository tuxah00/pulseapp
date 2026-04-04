-- =============================================
-- 021: Müşteri Fotoğraf Galerisi (Öncesi/Sonrası)
-- =============================================

CREATE TABLE customer_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES treatment_protocols(id) ON DELETE SET NULL,
  session_id UUID REFERENCES protocol_sessions(id) ON DELETE SET NULL,
  photo_url TEXT NOT NULL,
  photo_type TEXT NOT NULL CHECK (photo_type IN ('before','after','progress')),
  tags TEXT[] DEFAULT '{}',
  notes TEXT,
  taken_at DATE DEFAULT CURRENT_DATE,
  uploaded_by UUID REFERENCES staff_members(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexler
CREATE INDEX idx_customer_photos_business ON customer_photos(business_id);
CREATE INDEX idx_customer_photos_customer ON customer_photos(customer_id);
CREATE INDEX idx_customer_photos_protocol ON customer_photos(protocol_id);
CREATE INDEX idx_customer_photos_session ON customer_photos(session_id);

-- RLS
ALTER TABLE customer_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customer_photos_business_access" ON customer_photos
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );
