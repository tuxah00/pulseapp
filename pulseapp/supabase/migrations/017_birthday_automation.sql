-- =============================================
-- 017: Birthday Automation — Index
-- Doğum günü SMS otomasyonu için performans index'i
-- =============================================

-- Ay+Gün bazlı index — cron sorgularında hızlı birthday eşleşmesi
CREATE INDEX IF NOT EXISTS idx_customers_birthday
  ON customers (birthday)
  WHERE birthday IS NOT NULL;
