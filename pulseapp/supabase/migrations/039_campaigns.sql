-- ============================================
-- 039: Kampanya Yöneticisi
-- ============================================

CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  segment_filter JSONB NOT NULL DEFAULT '{}',
  message_template TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'auto' CHECK (channel IN ('auto', 'sms', 'whatsapp')),
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'sending', 'completed', 'cancelled')),
  stats JSONB NOT NULL DEFAULT '{"total_recipients": 0, "sent": 0, "errors": 0}',
  created_by_staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS campaign_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  sent_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_business_id ON campaigns(business_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled_at ON campaigns(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);

ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaigns_service_role" ON campaigns
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "campaigns_staff_all" ON campaigns
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      WHERE sm.business_id = campaigns.business_id AND sm.user_id = auth.uid()
    )
  );

CREATE POLICY "campaign_recipients_service_role" ON campaign_recipients
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "campaign_recipients_staff_select" ON campaign_recipients
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM campaigns c
      JOIN staff_members sm ON sm.business_id = c.business_id
      WHERE c.id = campaign_recipients.campaign_id AND sm.user_id = auth.uid()
    )
  );
