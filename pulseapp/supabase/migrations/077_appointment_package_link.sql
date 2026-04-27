-- Migration 077: Randevu → Paket bağlantısı
--
-- Amacı: Paket seansı ile oluşturulan randevuları paketle ilişkilendir.
-- Bu sayede:
--   • Seans düşümü randevu tamamlanınca doğru pakete yapılır
--   • Randevu kartlarında "📦 Paket Seansı" badge gösterilebilir
--   • Paket iptal edilse bile package_name denormalize olarak saklanır

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS customer_package_id UUID REFERENCES customer_packages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS package_name TEXT,
  ADD COLUMN IF NOT EXISTS package_unit_price NUMERIC;

-- customer_package_id üzerinde partial index (boş olmayan kayıtlar için)
CREATE INDEX IF NOT EXISTS idx_appointments_customer_package
  ON appointments(customer_package_id)
  WHERE customer_package_id IS NOT NULL;
