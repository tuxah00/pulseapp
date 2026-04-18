-- Faz 11: Tutorial modu — personel başına ilerleme takibi
-- tutorial_progress JSONB şekli:
-- {
--   enabled: boolean,              -- varsayılan true (personel ayarlardan kapatabilir)
--   setup_completed_at: string,    -- ISO timestamp (ilk kurulum sihirbazı tamamlandığında)
--   seen_pages: string[],          -- gördüğü tutorial balonlarının pageKey listesi
--   dismissed_at: string           -- opsiyonel, kullanıcı global kapattıysa
-- }

ALTER TABLE staff_members
  ADD COLUMN IF NOT EXISTS tutorial_progress JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN staff_members.tutorial_progress IS
  'Personel başına tutorial ilerlemesi: enabled, setup_completed_at, seen_pages[], dismissed_at';
