-- 078_gap_fill_appointment_optional.sql
-- Bekleme listesi proaktif tarama (yeni kayıt eklendiğinde takvimde uygun slot
-- bulunca direkt bildirim) için gap_fill_notifications.appointment_id'yi
-- nullable yap. Proaktif tarama mevcut bir randevuyla bağlantılı değil — sadece
-- boş bir slot bilgisi (date+time+service+staff).
--
-- Eski iptal akışı için appointment_id hâlâ doldurulur, yeni proaktif akış için
-- NULL kalır. source kolonu hangi akıştan geldiğini ayırt eder.

ALTER TABLE gap_fill_notifications
  ALTER COLUMN appointment_id DROP NOT NULL;

-- source CHECK constraint'i 'proactive' değerini kabul edecek şekilde genişlet
-- (önce eski constraint'i kaldır, yeniden ekle)
ALTER TABLE gap_fill_notifications
  DROP CONSTRAINT IF EXISTS gap_fill_notifications_source_check;

ALTER TABLE gap_fill_notifications
  ADD CONSTRAINT gap_fill_notifications_source_check
  CHECK (source IN ('waitlist', 'history', 'proactive'));

COMMENT ON COLUMN gap_fill_notifications.appointment_id IS
  'NULL = proaktif tarama (boş slot tespit edildi), dolu = iptal edilen randevu';
COMMENT ON COLUMN gap_fill_notifications.source IS
  'waitlist (iptal sonrası bekleme listesi), proactive (yeni kayıt sonrası takvim taraması), history (deprecated)';
