-- ================================================
-- 056_waitlist_sequential.sql
-- Sıralı bildirim + misafir bekleme desteği
--   1) gap_fill_notifications.customer_id NOT NULL -> NULLABLE
--      (misafir/auto-create edilmemiş bekleme için insert fail etmesin)
--   2) waitlist_entries.notification_expires_at kolonu
--      (bildirim gönderildikten sonra X dk içinde cevap yoksa sıradakine geç)
-- ================================================

ALTER TABLE public.gap_fill_notifications
  ALTER COLUMN customer_id DROP NOT NULL;

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS notification_expires_at timestamptz;

-- Hold bildirim hangi iptal edilen randevu için gönderildi? "Sıradakine gönder" butonu
-- bu appointment_id üzerinden fill-gap/next endpointini çağırır.
ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS notified_for_appointment_id uuid REFERENCES public.appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS waitlist_notif_expires_idx
  ON public.waitlist_entries(business_id, notification_expires_at)
  WHERE is_active = true AND is_notified = true;
