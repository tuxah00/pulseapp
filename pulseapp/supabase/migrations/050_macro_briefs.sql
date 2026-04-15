-- Faz 13: Haftalık sektör gündem özeti tablosu
-- Pazartesi sabah cron'u OpenAI'dan sektör başına 1 kayıt üretir; dashboard + AI asistan okur.

CREATE TABLE IF NOT EXISTS macro_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sector TEXT NOT NULL,
  headline TEXT NOT NULL,
  notes JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_macro_briefs_sector_valid
  ON macro_briefs (sector, expires_at DESC);

-- RLS: authenticated kullanıcılar okuyabilir (hepsine ortak), service role yazar.
ALTER TABLE macro_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "macro_briefs_select_authenticated" ON macro_briefs;
CREATE POLICY "macro_briefs_select_authenticated"
  ON macro_briefs FOR SELECT
  TO authenticated
  USING (true);
