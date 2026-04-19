-- 050_create_feedback.sql — Müşteri portalından geri bildirim (öneri/şikayet/teşekkür/soru)
-- Portal tarafında /feedback sayfasından oluşturulur; işletme dashboard panelinde listelenir.

CREATE TABLE IF NOT EXISTS feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  customer_phone TEXT,
  type TEXT NOT NULL CHECK (type IN ('suggestion','complaint','praise','question')),
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved','closed')),
  response TEXT,
  responded_at TIMESTAMPTZ,
  responded_by_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  source TEXT DEFAULT 'portal' CHECK (source IN ('portal','staff_manual')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_business ON feedback(business_id);
CREATE INDEX IF NOT EXISTS idx_feedback_customer ON feedback(customer_id);
CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback(business_id, status);
CREATE INDEX IF NOT EXISTS idx_feedback_created ON feedback(business_id, created_at DESC);

ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS feedback_business_isolation ON feedback;
CREATE POLICY feedback_business_isolation ON feedback USING (
  business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
);

-- updated_at trigger — projede standart trigger_set_updated_at() var mı kontrol edilmedi, inline tanımlanıyor
CREATE OR REPLACE FUNCTION feedback_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feedback_updated_at ON feedback;
CREATE TRIGGER feedback_updated_at
  BEFORE UPDATE ON feedback
  FOR EACH ROW EXECUTE FUNCTION feedback_set_updated_at();
