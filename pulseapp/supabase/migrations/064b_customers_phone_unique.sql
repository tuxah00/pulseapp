-- 064b_customers_phone_unique.sql
-- Aynı telefon + işletme kombinasyonunda duplicate müşteri oluşmasını önler
-- auto-book ve book endpoint'lerindeki TOCTOU yarışını DB seviyesinde kilitler

-- Önce mevcut duplicate'leri temizle (en yeni kaydı koru)
DELETE FROM customers a USING customers b
WHERE a.id > b.id
  AND a.business_id = b.business_id
  AND a.phone = b.phone
  AND a.phone IS NOT NULL;

-- Unique partial index (phone null ise atla — telefonsuz müşteri kaydı olabilir)
CREATE UNIQUE INDEX IF NOT EXISTS uq_customers_business_phone
  ON customers(business_id, phone)
  WHERE phone IS NOT NULL;
