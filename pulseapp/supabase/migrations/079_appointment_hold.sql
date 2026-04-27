-- 079_appointment_hold.sql
-- Bekleme listesi proaktif tarama → "tutulmuş randevu" akışı.
--
-- Sistem bir bekleme listesi kaydı için takvimde uygun slot bulduğunda artık
-- sadece SMS atmaz; takvime placeholder bir randevu da yazar. Bu randevu:
--   - status = 'pending' (mevcut çakışma kontrolleri otomatik dolu sayar)
--   - held_until = bildirim sonrası süresinin sonu (varsayılan 15 dk sonrası)
--   - held_for_waitlist_entry_id = hangi bekleme listesi kaydından geldi
--   - manage_token = müşteri onay/iptal için (mevcut /book/manage akışı kullanır)
--
-- Müşteri linke tıklayıp "Onayla" derse held_until NULL yapılır → normal randevu.
-- Süre dolarsa cleanup işlemi soft delete (deleted_at) yapar + sıradaki uygun
-- bekleme listesi kaydına devreder.

ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS held_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_for_waitlist_entry_id UUID
    REFERENCES waitlist_entries(id) ON DELETE SET NULL;

COMMENT ON COLUMN appointments.held_until IS 'NULL = normal randevu. Doluysa müşteri onayı bekleniyor veya süresi dolmuş (cleanup soft delete edecek)';

COMMENT ON COLUMN appointments.held_for_waitlist_entry_id IS
  'Bu randevu hangi bekleme listesi kaydı için tutuldu (proaktif tarama akışı)';

-- Cleanup ve UI render için partial index
CREATE INDEX IF NOT EXISTS idx_appointments_held_pending
  ON appointments(business_id, held_until)
  WHERE held_until IS NOT NULL AND deleted_at IS NULL;
