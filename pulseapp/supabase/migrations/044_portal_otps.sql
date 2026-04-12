-- ============================================================
-- Migration 044: Müşteri Portal OTP tablosu
-- ============================================================

CREATE TABLE IF NOT EXISTS portal_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_otps_business_phone ON portal_otps(business_id, phone);
CREATE INDEX IF NOT EXISTS idx_portal_otps_expires_at ON portal_otps(expires_at);

ALTER TABLE portal_otps ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'portal_otps' AND policyname = 'portal_otps_service_role') THEN
    CREATE POLICY portal_otps_service_role ON portal_otps FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;
