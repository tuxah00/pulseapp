-- ============================================
-- WhatsApp Konuşma Durumu tablosu
-- Çok adımlı konuşma akışlarını (randevu erteleme, iptal onayı vb.) takip eder
-- ============================================

CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_phone TEXT NOT NULL,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  state TEXT NOT NULL DEFAULT 'idle'
    CHECK (state IN (
      'idle',
      'awaiting_reschedule_date',
      'awaiting_reschedule_confirm',
      'awaiting_cancel_confirm'
    )),
  context JSONB NOT NULL DEFAULT '{}',
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(business_id, customer_phone)
);

CREATE INDEX idx_wa_conv_business_phone ON whatsapp_conversations(business_id, customer_phone);
CREATE INDEX idx_wa_conv_state ON whatsapp_conversations(state) WHERE state != 'idle';
CREATE INDEX idx_wa_conv_last_message ON whatsapp_conversations(last_message_at);

ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Business members can view own conversations"
  ON whatsapp_conversations FOR SELECT
  USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Service role full access on conversations"
  ON whatsapp_conversations FOR ALL
  USING (true)
  WITH CHECK (true);
