-- =============================================
-- 057: follow_up_queue reformu (Sprint 8)
-- - status enum: in_progress, no_response, done, rescheduled eklendi
-- - notes: takip sonuç/sebep notu (serbest metin)
-- - status_history: her durum değişikliğinin zaman/kullanıcı log'u (JSONB array)
-- =============================================

-- status CHECK constraint güncelle
ALTER TABLE follow_up_queue
  DROP CONSTRAINT IF EXISTS follow_up_queue_status_check;

ALTER TABLE follow_up_queue
  ADD CONSTRAINT follow_up_queue_status_check
  CHECK (status IN ('pending','in_progress','sent','no_response','done','rescheduled','cancelled'));

-- notes kolonu
ALTER TABLE follow_up_queue
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- status_history JSONB array: [{status, changed_at, staff_id, staff_name, note}]
ALTER TABLE follow_up_queue
  ADD COLUMN IF NOT EXISTS status_history JSONB DEFAULT '[]'::jsonb NOT NULL;
