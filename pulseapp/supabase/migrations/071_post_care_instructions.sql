-- 071_post_care_instructions.sql
-- Tedavi sonrası bakım talimatları (estetik klinik + diş kliniği için kritik).
-- protocol_sessions: seans bazında talimat (override edilebilir)
-- services: hizmet için varsayılan talimat (yeni seans tamamlandığında kopyalanır)

ALTER TABLE protocol_sessions
  ADD COLUMN IF NOT EXISTS post_care_notes text,
  ADD COLUMN IF NOT EXISTS post_care_files jsonb DEFAULT '[]'::jsonb;

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS default_post_care_notes text,
  ADD COLUMN IF NOT EXISTS default_post_care_files jsonb DEFAULT '[]'::jsonb;
