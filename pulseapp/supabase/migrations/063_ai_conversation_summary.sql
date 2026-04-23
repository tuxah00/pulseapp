-- AI Sohbet Özetleme (Context Window Yönetimi)
-- Uzun sohbetlerde (50+ mesaj) bağlamı korumak için özet tutulur
-- Nightly cron 'ai-memory-extractor' bu kolonu doldurur

ALTER TABLE ai_conversations
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS message_count_at_summary INT DEFAULT 0;

-- Özetlenmeye hazır uzun sohbetleri bulmak için partial index
-- (summary boşsa veya son özetten sonra 20+ yeni mesaj varsa)
CREATE INDEX IF NOT EXISTS idx_ai_conversations_needs_summary
  ON ai_conversations (updated_at)
  WHERE summary IS NULL OR summary_updated_at IS NULL;

COMMENT ON COLUMN ai_conversations.summary IS
  'Uzun sohbetin özeti (nightly cron tarafından güncellenir). Yeni sohbet başında system prompta enjekte edilir.';
