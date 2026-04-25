-- 073_customer_referral_code.sql
-- Müşteri başına unique tavsiye kodu. Portal'da "Arkadaşını Davet Et" linki için.
-- Format: /r/<referral_code> → /book/<businessId> redirect + referrals satırı

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_referral_code
  ON customers(referral_code)
  WHERE referral_code IS NOT NULL;
