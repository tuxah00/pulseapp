-- 054_reviews_anonymous.sql
-- Müşteri portalı yorumlarında anonim seçeneği

ALTER TABLE reviews
  ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT false NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reviews_is_anonymous
  ON reviews(is_anonymous)
  WHERE is_anonymous = true;
