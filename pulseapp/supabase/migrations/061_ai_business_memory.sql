-- AI Asistan Uzun Vadeli Hafıza (Long-term Memory)
-- İşletme, müşteri ve personel düzeyinde yapılandırılmış tercih/kural depolama
--
-- Scope örnekleri:
--   business: tone_preference, off_hours_messaging, default_channel
--   customer: triggers_negative, loves, communication_prefs, allergies_notes
--   staff:    working_style, short_replies, unavailable_hours
--
-- Kaynak (source):
--   explicit_user:      Kullanıcı asistana açıkça söyledi (confidence=1.0 varsayılan)
--   inferred_behavior:  Nightly cron pattern çıkardı (confidence 0.5-0.8)
--   cron_analysis:      Sistem otomatik analizinden (heuristic)

CREATE TABLE IF NOT EXISTS ai_business_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('business', 'customer', 'staff')),
  scope_id UUID, -- customer_id veya staff_id (scope='business' ise NULL)
  key TEXT NOT NULL,
  value JSONB NOT NULL,
  confidence NUMERIC(3,2) NOT NULL DEFAULT 0.80 CHECK (confidence >= 0 AND confidence <= 1),
  source TEXT NOT NULL DEFAULT 'explicit_user' CHECK (source IN ('explicit_user', 'inferred_behavior', 'cron_analysis')),
  created_by_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  last_reinforced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique constraint: aynı scope için aynı key sadece bir kez
-- (mevcut kayıt update edilir, yeni satır eklenmez)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_memory_unique
  ON ai_business_memory (business_id, scope, COALESCE(scope_id::text, 'null'), key);

-- Sık sorgulanan alanlar için index
CREATE INDEX IF NOT EXISTS idx_ai_memory_business_scope
  ON ai_business_memory (business_id, scope);

CREATE INDEX IF NOT EXISTS idx_ai_memory_customer
  ON ai_business_memory (business_id, scope_id)
  WHERE scope = 'customer';

-- Süresi dolmuş hafızayı bulmak için (nightly cleanup)
CREATE INDEX IF NOT EXISTS idx_ai_memory_expires
  ON ai_business_memory (expires_at)
  WHERE expires_at IS NOT NULL;

-- RLS
ALTER TABLE ai_business_memory ENABLE ROW LEVEL SECURITY;

-- Okuma: işletme personeli kendi business'ının hafızasını okuyabilir
CREATE POLICY "ai_memory_select_own_business"
  ON ai_business_memory FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Yazma: sadece yetkili personel (asistan admin client üzerinden de yazar)
CREATE POLICY "ai_memory_insert_own_business"
  ON ai_business_memory FOR INSERT
  WITH CHECK (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_memory_update_own_business"
  ON ai_business_memory FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "ai_memory_delete_own_business"
  ON ai_business_memory FOR DELETE
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- updated_at otomatik güncelleme trigger
CREATE OR REPLACE FUNCTION update_ai_memory_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_memory_updated_at ON ai_business_memory;
CREATE TRIGGER trg_ai_memory_updated_at
  BEFORE UPDATE ON ai_business_memory
  FOR EACH ROW
  EXECUTE FUNCTION update_ai_memory_updated_at();

-- KVKK uyumluluk: müşteri veya personel hard delete olduğunda hafıza kayıtları da silinir.
-- (customers.is_active=false soft delete değildir — gerçek DELETE ise trigger devreye girer)
CREATE OR REPLACE FUNCTION delete_ai_memory_on_customer_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ai_business_memory
  WHERE business_id = OLD.business_id
    AND scope = 'customer'
    AND scope_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trg_ai_memory_cleanup_customer ON customers;
CREATE TRIGGER trg_ai_memory_cleanup_customer
  AFTER DELETE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION delete_ai_memory_on_customer_delete();

CREATE OR REPLACE FUNCTION delete_ai_memory_on_staff_delete()
RETURNS TRIGGER AS $$
BEGIN
  DELETE FROM ai_business_memory
  WHERE business_id = OLD.business_id
    AND scope = 'staff'
    AND scope_id = OLD.id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public;

DROP TRIGGER IF EXISTS trg_ai_memory_cleanup_staff ON staff_members;
CREATE TRIGGER trg_ai_memory_cleanup_staff
  AFTER DELETE ON staff_members
  FOR EACH ROW
  EXECUTE FUNCTION delete_ai_memory_on_staff_delete();

COMMENT ON TABLE ai_business_memory IS
  'AI asistan uzun vadeli hafıza — işletme/müşteri/personel tercih ve kurallarını saklar. Sohbet arası kalıcı bilgi (örn: "bu müşteriye sayın diye hitap et"). KVKK uyumlu: customer/staff hard delete olduğunda otomatik temizlenir.';
