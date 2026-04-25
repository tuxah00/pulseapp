-- ================================================
-- 072_staff_tags.sql
-- Personel etiket (tag) sütunu
-- ================================================
-- Personellere "Doktor", "Hemşire", "Asistan", "Resepsiyon" gibi mesleki
-- etiketler atamak için kullanılır. Etiket havuzu (`staff_tag_options`)
-- businesses.settings JSONB altında saklanır — schema değişikliği yok.

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS tags jsonb NOT NULL DEFAULT '[]'::jsonb;

-- GIN index — JSONB array'de hızlı içerme sorgusu (`tags @> '["Doktor"]'`)
CREATE INDEX IF NOT EXISTS idx_staff_members_tags
  ON public.staff_members USING GIN (tags);

COMMENT ON COLUMN public.staff_members.tags IS
  'Personel mesleki etiketleri (string array, JSONB). İşletme bazlı etiket havuzu businesses.settings.staff_tag_options altındadır.';
