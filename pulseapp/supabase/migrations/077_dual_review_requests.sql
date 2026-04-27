-- 077_dual_review_requests.sql
-- İki katmanlı yorum talebi sistemi:
--   1) Deneyim yorumu (experience): hizmetten hemen sonra (varsayılan 1 gün)
--      → Klinik, personel, deneyim hakkında değerlendirme (Google'a yönlendirilir)
--   2) Sonuç yorumu (result): sonuçların görülmesi için zaman geçen işlemlerde
--      → Burun estetiği (28 gün), implant (30 gün), saç ekimi (90 gün) vb.
--      → result_review_delay_days NULL ise bu adım atlanır.

-- 1) services tablosuna yorum gecikme kolonları
ALTER TABLE services
  ADD COLUMN IF NOT EXISTS experience_review_delay_days INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS result_review_delay_days INTEGER;

COMMENT ON COLUMN services.experience_review_delay_days IS
  'Hizmetten kaç gün sonra deneyim yorumu istensin (NULL = istenmez, 0 = aynı gün, 1 = ertesi gün)';
COMMENT ON COLUMN services.result_review_delay_days IS
  'Sonuçların görülmesi için kaç gün gerekiyor — bu süre sonra ikinci yorum (sonuç) talebi gönderilir. NULL ise bu adım atlanır.';

-- 2) appointments tablosuna sonuç yorumu işareti
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS result_review_requested BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN appointments.result_review_requested IS
  'Sonuç yorumu (ikinci dalga) talebi gönderildi mi? review_requested = deneyim yorumu için ayrı bir bayrak.';

-- 3) Cron için partial index — sadece henüz sonuç yorumu istenmemiş
--    completed randevular taranır.
CREATE INDEX IF NOT EXISTS idx_appointments_result_review_pending
  ON appointments(business_id, updated_at)
  WHERE status = 'completed' AND result_review_requested = false AND deleted_at IS NULL;

-- 4) Tipik gecikmeli sonuç işlemleri için makul varsayılanlar.
--    Sadece result_review_delay_days NULL olan kayıtları günceller (idempotent).
--    Estetik klinik & diş kliniği işlemleri için sektörel ortalamalar.

-- Burun estetiği (rinoplasti) — 4 hafta
UPDATE services
   SET result_review_delay_days = 28
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(burun estet|rinoplasti|nose job|nasal)';

-- Saç ekimi — 3 ay (yeni saçlar bu sürede çıkar)
UPDATE services
   SET result_review_delay_days = 90
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(saç ekim|hair transplant|saç nakil)';

-- Diş implantı — 1 ay (osseointegrasyon başlangıcı)
UPDATE services
   SET result_review_delay_days = 30
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(implant|kanal tedav|root canal)';

-- Diş protezi / kaplama — 3 hafta
UPDATE services
   SET result_review_delay_days = 21
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(protez|kaplama|veneer|crown|köprü)';

-- Diş beyazlatma — 2 hafta
UPDATE services
   SET result_review_delay_days = 14
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(beyazlat|whitening|bleaching)';

-- Botoks — 2 hafta (etki tam yerleşir)
UPDATE services
   SET result_review_delay_days = 14
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(botoks|botox|botulin)';

-- Dolgu (filler) — 2 hafta (şişlik iner, sonuç netleşir)
UPDATE services
   SET result_review_delay_days = 14
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(dolgu|filler|hyaluronik)';

-- Lazer epilasyon — 6 hafta (1 seans sonrası dökülme süreci)
UPDATE services
   SET result_review_delay_days = 42
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(lazer epilasy|laser hair)';

-- Ortognatik / çene cerrahisi — 6 hafta
UPDATE services
   SET result_review_delay_days = 42
 WHERE result_review_delay_days IS NULL
   AND lower(name) ~ '(ortognatik|çene cerrah|jaw surgery)';
