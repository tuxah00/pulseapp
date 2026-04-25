-- 072_preferred_channel_email.sql
-- customers.preferred_channel CHECK constraint'ına 'email' değeri eklenir.
-- Müşteri portal'da bildirim tercihi olarak e-posta seçebilsin.

ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_preferred_channel_check;
ALTER TABLE customers ADD CONSTRAINT customers_preferred_channel_check
  CHECK (preferred_channel IN ('sms','whatsapp','email','auto'));
