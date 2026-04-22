-- =============================================
-- 060: customer_photos — AI analizi + portfolio yayımlama + staff-initiated eşleştirme
-- Estetik klinik (medical_aesthetic) pilotunun dashboard galerisi için:
--  - is_public: portfolio'ya yayımlanan fotoğrafları işaretler
--  - ai_analysis: AI karşılaştırma sonucu (JSONB) cache'lenir
--  - pair_id: before/after fotoğraflarını session'dan bağımsız eşleştirmek için
--    (session_id protocol_sessions FK olduğu için staff direkt upload'ta kullanılamaz)
-- =============================================

ALTER TABLE customer_photos
  ADD COLUMN IF NOT EXISTS ai_analysis JSONB;

ALTER TABLE customer_photos
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE customer_photos
  ADD COLUMN IF NOT EXISTS pair_id UUID;

-- Public portfolio sorgusu için partial index
CREATE INDEX IF NOT EXISTS idx_customer_photos_public
  ON customer_photos (business_id)
  WHERE is_public = true;

-- Before/after eşleştirmeyi hızlandırmak için pair index
CREATE INDEX IF NOT EXISTS idx_customer_photos_pair
  ON customer_photos (pair_id)
  WHERE pair_id IS NOT NULL;

-- Anonim ziyaretçiler sadece is_public=true fotoğrafları görebilir
DROP POLICY IF EXISTS "customer_photos_public_read" ON customer_photos;
CREATE POLICY "customer_photos_public_read" ON customer_photos
  FOR SELECT
  TO anon
  USING (is_public = true);
