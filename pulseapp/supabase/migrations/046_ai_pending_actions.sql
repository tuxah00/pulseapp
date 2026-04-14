-- AI Asistan — Bekleyen Eylem Tablosu
-- Riskli yazma işlemleri önce bu tabloya kaydedilir; kullanıcı onayladığında yürütülür.

CREATE TABLE IF NOT EXISTS ai_pending_actions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES ai_conversations(id) ON DELETE SET NULL,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  preview TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'executed', 'cancelled', 'expired')),
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '10 minutes'),
  executed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_ai_pending_staff ON ai_pending_actions(staff_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_pending_conv ON ai_pending_actions(conversation_id);
CREATE INDEX IF NOT EXISTS idx_ai_pending_expires ON ai_pending_actions(expires_at) WHERE status = 'pending';

-- RLS
ALTER TABLE ai_pending_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view their pending actions" ON ai_pending_actions;
CREATE POLICY "Staff can view their pending actions" ON ai_pending_actions
  FOR SELECT USING (
    staff_id IN (SELECT id FROM staff_members WHERE user_id = auth.uid() AND is_active = true)
  );
