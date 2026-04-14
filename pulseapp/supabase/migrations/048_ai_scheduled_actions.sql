-- AI asistanı zamanlanmış eylemler (Faz 5)
-- ai_pending_actions tablosuna scheduled_for, recurrence_rule kolonları ve
-- yeni status değerleri ('scheduled', 'failed') eklenir.

ALTER TABLE ai_pending_actions
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;

ALTER TABLE ai_pending_actions
  ADD COLUMN IF NOT EXISTS recurrence_rule JSONB;

ALTER TABLE ai_pending_actions
  DROP CONSTRAINT IF EXISTS ai_pending_actions_status_check;

ALTER TABLE ai_pending_actions
  ADD CONSTRAINT ai_pending_actions_status_check
  CHECK (status IN ('pending','scheduled','executed','cancelled','expired','failed'));

CREATE INDEX IF NOT EXISTS idx_ai_pending_actions_scheduled
  ON ai_pending_actions (scheduled_for)
  WHERE status = 'scheduled';
