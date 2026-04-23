-- ================================================================
-- 064 — AI Event Queue (Faz 4 — Proaktif Danışman)
-- Postgres trigger'lar ve cron'lar olayları buraya yazar.
-- ai-watcher cron'u işler ve ai_insights'a dönüştürür.
-- ================================================================

CREATE TABLE IF NOT EXISTS ai_event_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'no_show',
    'slot_gap',
    'invoice_overdue',
    'customer_churned',
    'revenue_anomaly',
    'manual_work_detected',
    'review_negative',
    'stock_low'
  )),
  related_entity_type TEXT,
  related_entity_id UUID,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed')),
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_event_queue_pending
  ON ai_event_queue (business_id, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_ai_event_queue_business
  ON ai_event_queue (business_id, event_type, created_at DESC);

ALTER TABLE ai_event_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_event_queue_select_own ON ai_event_queue;
CREATE POLICY ai_event_queue_select_own
  ON ai_event_queue
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );
