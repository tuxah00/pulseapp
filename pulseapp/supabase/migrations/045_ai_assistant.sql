-- =============================================
-- 045: AI Assistant — Sohbet, Mesaj & Kullanım Tabloları
-- =============================================

-- 1. AI Conversations
CREATE TABLE IF NOT EXISTS ai_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  title TEXT,
  is_onboarding BOOLEAN DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_conversations_staff_access" ON ai_conversations
  FOR ALL USING (
    staff_id IN (
      SELECT id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_conversations_staff ON ai_conversations(staff_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_business ON ai_conversations(business_id);

-- 2. AI Messages
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'tool')),
  content TEXT,
  tool_calls JSONB,
  tool_name TEXT,
  tool_call_id TEXT,
  tool_result JSONB,
  tokens_used INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_messages_via_conversation" ON ai_messages
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM ai_conversations WHERE staff_id IN (
        SELECT id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
      )
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id, created_at);

-- 3. AI Usage (plan limiti takibi)
CREATE TABLE IF NOT EXISTS ai_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id),
  month TEXT NOT NULL,
  message_count INTEGER DEFAULT 0,
  total_input_tokens INTEGER DEFAULT 0,
  total_output_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(business_id, staff_id, month)
);

ALTER TABLE ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_usage_staff_access" ON ai_usage
  FOR ALL USING (
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid() AND is_active = true
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_usage_business_month ON ai_usage(business_id, month);
