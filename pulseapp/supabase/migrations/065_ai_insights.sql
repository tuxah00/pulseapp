-- ================================================================
-- 065 — AI Insights (Faz 4 — Proaktif Danışman)
-- Asistanın işletme sahibine sunduğu proaktif öneriler.
-- ai-watcher / ai-pattern-detector / ai-weekly-plan cron'ları
-- bu tabloya yazar. UI "ampul" rozetinde gösterilir.
-- ================================================================

CREATE TABLE IF NOT EXISTS ai_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('opportunity', 'risk', 'suggestion', 'automation_proposal')),
  title TEXT NOT NULL,
  body TEXT,
  suggested_action JSONB,
  severity TEXT NOT NULL DEFAULT 'normal' CHECK (severity IN ('info', 'normal', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'viewed', 'dismissed', 'acted')),
  source_event_type TEXT,
  related_entity_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_insights_new
  ON ai_insights (business_id, created_at DESC)
  WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_ai_insights_business
  ON ai_insights (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_insights_dedup
  ON ai_insights (business_id, source_event_type, related_entity_id, created_at DESC);

ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ai_insights_select_own ON ai_insights;
CREATE POLICY ai_insights_select_own
  ON ai_insights
  FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS ai_insights_update_own ON ai_insights;
CREATE POLICY ai_insights_update_own
  ON ai_insights
  FOR UPDATE
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );
