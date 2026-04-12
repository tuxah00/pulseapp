-- ============================================
-- 038: Periyodik Kontrol Hatırlatıcı
-- ============================================

-- Hizmetlere önerilen tekrar süresi ekleme
ALTER TABLE services ADD COLUMN IF NOT EXISTS recommended_interval_days INTEGER;

-- Gönderilmiş periyodik hatırlatmaları takip etme (çift gönderim önleme)
CREATE TABLE IF NOT EXISTS periodic_reminders_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  last_appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_periodic_reminders_lookup
  ON periodic_reminders_sent (customer_id, service_id, sent_at DESC);

-- RLS
ALTER TABLE periodic_reminders_sent ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periodic_reminders_service_role" ON periodic_reminders_sent
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "periodic_reminders_staff_select" ON periodic_reminders_sent
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      WHERE sm.business_id = periodic_reminders_sent.business_id
        AND sm.user_id = auth.uid()
    )
  );
