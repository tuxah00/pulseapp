-- Otomasyon (cron + manuel tetik) çalıştırma log'u.
-- Pilot modunda Vercel Cron yok; personel dashboard'dan manuel tetikleyecek.
-- Bu tablo "son ne zaman çalıştı, kaç bildirim/mesaj üretti" bilgisini tutar.

CREATE TABLE IF NOT EXISTS automations_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  job_type TEXT NOT NULL,                   -- 'reminders' | 'birthday' | 'review_requests' | 'winback' | 'follow_up'
  triggered_by TEXT NOT NULL,               -- 'cron' | 'manual'
  triggered_user_id UUID,                   -- manuel tetikte staff_member.user_id (auth)
  result JSONB,                             -- { sent, failed, skipped, customers, ... }
  duration_ms INT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automations_log_business_time
  ON automations_log(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_automations_log_job_type
  ON automations_log(business_id, job_type, created_at DESC);

ALTER TABLE automations_log ENABLE ROW LEVEL SECURITY;

-- Aynı işletmeden olan staff okuyabilir
DROP POLICY IF EXISTS "automations_log staff read" ON automations_log;
CREATE POLICY "automations_log staff read" ON automations_log
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members
      WHERE user_id = auth.uid() AND is_active = true
    )
  );

-- Insert sadece service role (manuel tetik endpoint'i admin client kullanır)
-- Bu yüzden ayrı bir INSERT policy gerekmez; service_role bypass eder.
