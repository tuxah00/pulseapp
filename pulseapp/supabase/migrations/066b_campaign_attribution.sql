-- ================================================
-- 066_campaign_attribution.sql
-- Kampanya ROI takibi: randevuları gönderildikleri kampanyaya bağlar
-- ================================================
-- İş Zekası panelinde kampanya dönüşümünü gerçek veriyle hesaplamak için
-- appointments tablosuna kampanya referansları eklenir.
--   campaign_id           → hangi kampanyadan kaynaklandı
--   campaign_recipient_id → hangi spesifik SMS alıcısı tıkladı
-- Değer null kalabilir (doğrudan, organik randevular için).

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS campaign_id uuid
    REFERENCES public.campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_recipient_id uuid
    REFERENCES public.campaign_recipients(id) ON DELETE SET NULL;

-- Kampanya bazında appointment sorgularını hızlandırmak için partial index
CREATE INDEX IF NOT EXISTS idx_appointments_campaign
  ON public.appointments(campaign_id)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_campaign_recipient
  ON public.appointments(campaign_recipient_id)
  WHERE campaign_recipient_id IS NOT NULL;

COMMENT ON COLUMN public.appointments.campaign_id IS
  'Bu randevu hangi kampanyadan kaynaklandı (null=organik/doğrudan).';
COMMENT ON COLUMN public.appointments.campaign_recipient_id IS
  'Kampanyayı tetikleyen spesifik SMS/WhatsApp alıcısı (attribution).';
