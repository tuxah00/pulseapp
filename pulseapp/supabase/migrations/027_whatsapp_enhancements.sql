-- Migration 027: WhatsApp enhancements
-- Adds preferred_channel to customers + whatsapp_conversations index

-- Customers tablosuna tercih edilen kanal kolonu ekle
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS preferred_channel TEXT DEFAULT 'sms' CHECK (preferred_channel IN ('sms', 'whatsapp', 'auto'));

-- Hızlı lookup için index
CREATE INDEX IF NOT EXISTS idx_customers_preferred_channel
  ON customers (business_id, preferred_channel);

-- whatsapp_conversations tablosu zaten varsa index ekle
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'whatsapp_conversations') THEN
    CREATE INDEX IF NOT EXISTS idx_whatsapp_conversations_business_phone
      ON whatsapp_conversations (business_id, customer_phone);
  END IF;
END $$;
