-- 074_consultation_requests.sql
-- Ön Konsültasyon Talepleri — medical_aesthetic ve dental_clinic için lead yönetimi.
-- Yeni hasta adayı (henüz sistemde değil) public form üzerinden soru + fotoğraf gönderir.
-- Klinik personeli inceler, karar verir, randevuya çevirir.

-- 1) customers.lead_source
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS lead_source text
    CHECK (lead_source IN ('walk_in','booking','consultation','referral','campaign','manual'));

CREATE INDEX IF NOT EXISTS idx_customers_lead_source
  ON customers(business_id, lead_source) WHERE lead_source IS NOT NULL;

-- 2) consultation_requests tablosu
CREATE TABLE IF NOT EXISTS consultation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,

  -- Snapshot (customer'da değişse bile orijinali kalır)
  full_name text NOT NULL,
  phone text NOT NULL,
  email text,
  age integer CHECK (age IS NULL OR (age >= 0 AND age <= 120)),
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  service_label text,
  question text NOT NULL,
  health_notes text,
  photo_urls jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Workflow
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reviewing','suitable','not_suitable','needs_more_info','converted','archived')),
  reviewed_by_staff_id uuid REFERENCES staff_members(id) ON DELETE SET NULL,
  reviewed_by_staff_name text,
  reviewed_at timestamptz,
  decision_reason text,

  -- Conversion
  converted_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL,
  converted_at timestamptz,

  -- KVKK + spam guard
  consent_kvkk boolean NOT NULL DEFAULT false,
  consent_health_data boolean NOT NULL DEFAULT false,
  consent_marketing boolean NOT NULL DEFAULT false,
  consent_ip inet,
  consent_user_agent text,
  source_ip inet,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Index'ler
CREATE INDEX IF NOT EXISTS idx_consultation_business_status
  ON consultation_requests(business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_phone_recent
  ON consultation_requests(business_id, phone, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_consultation_open
  ON consultation_requests(business_id, created_at DESC)
  WHERE status IN ('pending','reviewing','needs_more_info');

-- 4) updated_at trigger
CREATE OR REPLACE FUNCTION set_consultation_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_consultation_updated_at
  BEFORE UPDATE ON consultation_requests
  FOR EACH ROW EXECUTE FUNCTION set_consultation_updated_at();

-- 5) RLS
ALTER TABLE consultation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultation_public_insert" ON consultation_requests
  FOR INSERT WITH CHECK (true);

CREATE POLICY "consultation_staff_all" ON consultation_requests
  FOR ALL USING (
    EXISTS (SELECT 1 FROM staff_members
            WHERE business_id = consultation_requests.business_id
              AND user_id = auth.uid())
  );

CREATE POLICY "consultation_service_role" ON consultation_requests
  FOR ALL USING (auth.role() = 'service_role');
