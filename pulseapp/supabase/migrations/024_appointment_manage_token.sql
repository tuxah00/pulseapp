-- =============================================
-- 024: Randevu Yönetim Token + Takip Kuyruğu
-- =============================================

-- Appointments tablosuna manage_token ekle
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS manage_token UUID DEFAULT gen_random_uuid();
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ;

CREATE INDEX idx_appointments_manage_token ON appointments(manage_token)
  WHERE manage_token IS NOT NULL;

-- Mevcut randevulara token ata
UPDATE appointments
SET manage_token = gen_random_uuid(),
    token_expires_at = created_at + INTERVAL '30 days'
WHERE manage_token IS NULL;

-- Seans sonrası takip kuyruğu
CREATE TABLE follow_up_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  appointment_id UUID NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  protocol_id UUID REFERENCES treatment_protocols(id) ON DELETE SET NULL,
  type TEXT NOT NULL
    CHECK (type IN ('post_session','next_session_reminder','protocol_completion')),
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','cancelled')),
  message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexler
CREATE INDEX idx_follow_up_queue_business ON follow_up_queue(business_id);
CREATE INDEX idx_follow_up_queue_status ON follow_up_queue(business_id, status);
CREATE INDEX idx_follow_up_queue_scheduled ON follow_up_queue(scheduled_for)
  WHERE status = 'pending';
CREATE INDEX idx_follow_up_queue_customer ON follow_up_queue(customer_id);

-- RLS
ALTER TABLE follow_up_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follow_up_queue_business_access" ON follow_up_queue
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );
