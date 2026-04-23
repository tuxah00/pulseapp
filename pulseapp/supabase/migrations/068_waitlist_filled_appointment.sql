-- ================================================
-- 068_waitlist_filled_appointment.sql
-- Bekleme listesi dönüşüm takibi
-- ================================================
-- İş Zekası panelinde "son 30 günde waitlist'ten X randevu doldu"
-- metriğini hesaplamak için waitlist_entries tablosuna hangi randevuya
-- dönüştüğü bilgisi eklenir. Auto-fill cron Vercel Pro ile gelecek,
-- şimdilik staff manuel doldurduğunda bu kolon set edilir.

ALTER TABLE public.waitlist_entries
  ADD COLUMN IF NOT EXISTS filled_appointment_id uuid
    REFERENCES public.appointments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS filled_at timestamptz;

-- Dönüşüm sayımını hızlandırmak için partial index
CREATE INDEX IF NOT EXISTS idx_waitlist_filled
  ON public.waitlist_entries(business_id, filled_at)
  WHERE filled_appointment_id IS NOT NULL;

COMMENT ON COLUMN public.waitlist_entries.filled_appointment_id IS
  'Bu waitlist kaydı hangi randevuya dönüştü (null=hâlâ beklemede).';
COMMENT ON COLUMN public.waitlist_entries.filled_at IS
  'Waitlist kaydı randevuya dönüştüğünde zaman damgası.';
