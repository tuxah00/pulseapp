-- Migration 028: KVKK (Kişisel Verilerin Korunması Kanunu) uyumluluk tabloları

-- customers tablosuna KVKK onayı alanı ekle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS kvkk_consent_given BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS kvkk_consent_given_at TIMESTAMPTZ;

-- Rıza kayıtları tablosu
CREATE TABLE IF NOT EXISTS consent_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id   UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_phone TEXT,
  consent_type  TEXT NOT NULL CHECK (consent_type IN ('kvkk', 'marketing', 'health_data', 'whatsapp')),
  given_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ,
  ip_address    TEXT,
  method        TEXT NOT NULL CHECK (method IN ('online_form', 'in_person', 'phone', 'whatsapp')),
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Veri silme/anonimleştirme talepleri tablosu
CREATE TABLE IF NOT EXISTS data_deletion_requests (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id    UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name  TEXT,
  customer_phone TEXT,
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at   TIMESTAMPTZ,
  status         TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  notes          TEXT,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- RLS politikaları
ALTER TABLE consent_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE data_deletion_requests ENABLE ROW LEVEL SECURITY;

-- consent_records: business üyesi okuyabilir
CREATE POLICY "consent_records_select" ON consent_records
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = consent_records.business_id
        AND staff_members.is_active = true
    )
  );

-- consent_records: herkes insert edebilir (public booking formu için)
CREATE POLICY "consent_records_insert" ON consent_records
  FOR INSERT WITH CHECK (true);

-- data_deletion_requests: business üyesi okuyabilir
CREATE POLICY "data_deletion_requests_select" ON data_deletion_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = data_deletion_requests.business_id
        AND staff_members.is_active = true
    )
  );

-- data_deletion_requests: herkes insert edebilir (müşteri talebi için)
CREATE POLICY "data_deletion_requests_insert" ON data_deletion_requests
  FOR INSERT WITH CHECK (true);

-- data_deletion_requests: business üyesi güncelleyebilir (işleme alınca)
CREATE POLICY "data_deletion_requests_update" ON data_deletion_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = data_deletion_requests.business_id
        AND staff_members.is_active = true
    )
  );

-- Performans indeksleri
CREATE INDEX IF NOT EXISTS idx_consent_records_business_customer
  ON consent_records (business_id, customer_id);

CREATE INDEX IF NOT EXISTS idx_consent_records_phone
  ON consent_records (business_id, customer_phone);

CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_business_status
  ON data_deletion_requests (business_id, status);
