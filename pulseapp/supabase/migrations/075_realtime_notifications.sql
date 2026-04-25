-- 075_realtime_notifications.sql
-- Realtime bildirim altyapısı: notifications + appointments tablolarını
-- supabase_realtime publication'a ekler. Bu sayede TopBar bell ikonu
-- ve dashboard randevu sayfası INSERT/UPDATE event'lerini canlı dinleyebilir.
--
-- Not: ALTER PUBLICATION ADD TABLE idempotent değildir; bu yüzden
-- mevcut durumu kontrol edip yalnızca eksikse ekleriz.

DO $$
BEGIN
  -- notifications — bell badge ve toast için kritik
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications';
  END IF;

  -- appointments — takvim canlı yenilensin diye
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'appointments'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments';
  END IF;

  -- consultation_requests — Ön Konsültasyon sayfası realtime için
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'consultation_requests'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_requests';
  END IF;
END $$;
