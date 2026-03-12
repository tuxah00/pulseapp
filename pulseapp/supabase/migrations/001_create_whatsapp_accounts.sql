-- ============================================
-- WhatsApp Business Accounts tablosu
-- Her işletme kendi WhatsApp Business hesabını bağlar
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  waba_id TEXT NOT NULL,
  phone_number_id TEXT NOT NULL UNIQUE,
  phone_number TEXT NOT NULL,
  display_name TEXT,
  access_token_encrypted TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'active', 'disconnected', 'suspended')),
  quality_rating TEXT,
  messaging_limit TEXT,
  connected_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_business ON whatsapp_accounts(business_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_phone_number_id ON whatsapp_accounts(phone_number_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_accounts_status ON whatsapp_accounts(status);

ALTER TABLE whatsapp_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view own whatsapp account"
  ON whatsapp_accounts FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Business owners can manage own whatsapp account"
  ON whatsapp_accounts FOR ALL
  USING (
    business_id IN (
      SELECT business_id FROM staff_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'manager')
    )
  );

-- messages tablosuna meta_message_id kolonu ekle
ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta_message_id TEXT;
