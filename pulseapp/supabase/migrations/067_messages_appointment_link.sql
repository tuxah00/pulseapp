-- ================================================
-- 067_messages_appointment_link.sql
-- Mesaj akışı ROI takibi: giden mesajları sonuçlanan randevuya bağlar
-- ================================================
-- İş Zekası panelinde workflow/cron mesajlarının (hatırlatma, winback,
-- doğum günü, yorum isteği vb.) ne kadar randevu ürettiğini ölçmek için
-- messages tablosuna opsiyonel bir attribution linki eklenir.
--
-- attributed_via değerleri:
--   direct  → Mesajda doğrudan booking linki var, müşteri tıkladı
--   window  → Mesaj sonrası 7 gün içinde randevu alındı (zaman bazlı)
--   manual  → Staff dashboard üzerinden elle işaretledi

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS related_appointment_id uuid
    REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attributed_via text
    CHECK (attributed_via IN ('direct', 'window', 'manual'));

-- İş Zekası ROI endpoint'i bu indexi heavy use eder
CREATE INDEX IF NOT EXISTS idx_messages_related_appt
  ON public.messages(related_appointment_id)
  WHERE related_appointment_id IS NOT NULL;

-- template_name + attribution → workflow bazlı dönüşüm rate hesaplama için
CREATE INDEX IF NOT EXISTS idx_messages_template_attribution
  ON public.messages(business_id, template_name)
  WHERE template_name IS NOT NULL AND related_appointment_id IS NOT NULL;

COMMENT ON COLUMN public.messages.related_appointment_id IS
  'Bu mesaj sonucu oluşan randevu (attribution için).';
COMMENT ON COLUMN public.messages.attributed_via IS
  'Attribution yöntemi: direct=link, window=7gün penceresi, manual=elle';
