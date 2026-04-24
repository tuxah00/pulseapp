-- ================================================
-- 069_campaign_recipient_short_code.sql
-- Kampanya SMS'inde {LINK} değişkeni için kısa kod desteği
-- ================================================
-- Amaç: /book/<uuid>?c=<uuid> (72 karakter) yerine /r/<8karakter> kullanmak.
-- SMS karakter limiti için kritik; kullanıcı arayüzünde daha temiz.
--
-- short_code: 8 karakterli URL-safe string (54-char alfabe, O/0/I/1/l hariç)
--   → ~72 trilyon kombinasyon, collision riski pratikte sıfır
--   → UNIQUE constraint güvence sağlar, collision durumunda insert retry
--
-- /r/<code> route'u short_code'u çözüp business_id + recipient_id'yi
-- booking sayfasına forward eder.

ALTER TABLE public.campaign_recipients
  ADD COLUMN IF NOT EXISTS short_code text UNIQUE;

-- WHERE klozu: yalnızca dolu short_code'lar indexlenir (eski kayıtlar null)
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_short_code
  ON public.campaign_recipients(short_code)
  WHERE short_code IS NOT NULL;

COMMENT ON COLUMN public.campaign_recipients.short_code IS
  'Kampanya linklerinde UUID yerine kullanılan 8-karakterli kısa kod (/r/<code>).';
