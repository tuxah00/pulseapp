-- 075_photos_appointment_id.sql
-- customer_photos tablosuna appointment_id FK eklenir.
-- Amaç: Bir randevuya bağlı öncesi/sonrası fotoğraflar.
-- Geriye dönük güvenli: nullable + ON DELETE SET NULL.

ALTER TABLE customer_photos
  ADD COLUMN IF NOT EXISTS appointment_id UUID
  REFERENCES appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_customer_photos_appointment
  ON customer_photos(appointment_id)
  WHERE appointment_id IS NOT NULL;

COMMENT ON COLUMN customer_photos.appointment_id IS
  'Fotoğrafın bağlı olduğu randevu (opsiyonel). Protokol/seans bağlamından bağımsız çalışır.';
