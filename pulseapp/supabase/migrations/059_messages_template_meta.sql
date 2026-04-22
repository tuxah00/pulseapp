-- =============================================
-- 059: messages — WhatsApp template metadata
-- Template'ten gönderilen mesajlar için şablon adı ve placeholder değerleri saklanır.
-- Hangi template'in hangi parametrelerle kullanıldığı analitik + denetim için izlenir.
-- =============================================

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS template_name TEXT;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS template_params JSONB;

-- Template kullanım analitiği için partial index (sadece template mesajlarda dolu)
CREATE INDEX IF NOT EXISTS idx_messages_template_name
  ON messages (business_id, template_name)
  WHERE template_name IS NOT NULL;
