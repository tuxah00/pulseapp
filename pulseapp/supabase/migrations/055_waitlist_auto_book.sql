-- ================================================
-- 055_waitlist_auto_book.sql
-- Bekleme listesi: boşluk oluştuğunda otomatik randevu alma bayrağı
-- ================================================

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS auto_book_on_match boolean NOT NULL DEFAULT false;

-- Filtreleme için partial index
CREATE INDEX IF NOT EXISTS waitlist_auto_book_idx
  ON public.waitlist_entries(business_id, auto_book_on_match)
  WHERE is_active = true AND is_notified = false AND auto_book_on_match = true;
