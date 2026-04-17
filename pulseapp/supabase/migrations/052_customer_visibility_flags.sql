-- =============================================
-- 052: Müşteri Görünürlük Bayrakları
-- Dosya ve fotoğrafların müşteri portalında görünüp görünmeyeceğini kontrol eder
-- Default: TRUE (mevcut tüm kayıtlar portalda görünür)
-- =============================================

ALTER TABLE public.business_records
  ADD COLUMN IF NOT EXISTS is_customer_visible BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.customer_photos
  ADD COLUMN IF NOT EXISTS is_customer_visible BOOLEAN NOT NULL DEFAULT true;

-- Partial indexler — sadece portal tarafında görünenleri hızlı sorgulamak için
CREATE INDEX IF NOT EXISTS idx_business_records_customer_visible
  ON public.business_records(customer_id, is_customer_visible)
  WHERE is_customer_visible = true;

CREATE INDEX IF NOT EXISTS idx_customer_photos_visible
  ON public.customer_photos(customer_id, is_customer_visible)
  WHERE is_customer_visible = true;
