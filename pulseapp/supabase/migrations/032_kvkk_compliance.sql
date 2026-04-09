-- Migration 032: KVKK Uyumu — rıza takibi ve veri silme talepleri

-- Rıza kayıtları
CREATE TABLE IF NOT EXISTS consent_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_phone  TEXT,
  consent_type    TEXT NOT NULL CHECK (consent_type IN ('kvkk', 'marketing', 'health_data', 'whatsapp')),
  given_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at      TIMESTAMPTZ,
  ip_address      TEXT,
  method          TEXT DEFAULT 'online_form' CHECK (method IN ('online_form', 'in_person', 'phone', 'whatsapp')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Veri silme/anonimleştirme talepleri
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id     UUID REFERENCES customers(id) ON DELETE CASCADE,
  customer_name   TEXT,
  customer_phone  TEXT,
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  status          TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  notes           TEXT,
  processed_by    UUID REFERENCES staff_members(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Müşteri tablosuna KVKK onay alanı
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS kvkk_consent_given BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kvkk_consent_given_at TIMESTAMPTZ;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_consent_customer ON consent_records (customer_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_business ON consent_records (business_id);
CREATE INDEX IF NOT EXISTS idx_deletion_requests_business ON data_deletion_requests (business_id, status);

-- RLS
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consent_select" ON consent_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = consent_records.business_id
        AND staff_members.is_active = true
    )
  );

CREATE POLICY "consent_insert" ON consent_records
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = consent_records.business_id
        AND staff_members.is_active = true
    )
    OR
    -- Public booking'ten gelen rıza kayıtları (auth olmadan)
    consent_records.method = 'web'
  );

CREATE POLICY "deletion_select" ON data_deletion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = data_deletion_requests.business_id
        AND staff_members.is_active = true
    )
  );

CREATE POLICY "deletion_insert" ON data_deletion_requests
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = data_deletion_requests.business_id
        AND staff_members.is_active = true
    )
  );

CREATE POLICY "deletion_update" ON data_deletion_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = data_deletion_requests.business_id
        AND staff_members.is_active = true
    )
  );
