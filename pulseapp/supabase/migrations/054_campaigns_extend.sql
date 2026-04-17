-- 054: Kampanyalara bitiş tarihi ve maksimum alıcı sayısı eklendi
-- expires_at: Kampanya portal'da gösterilecek son tarih (NULL ise süresiz)
-- max_recipients: Bu kampanyadan yararlanabilecek maksimum müşteri sayısı (NULL ise sınırsız)

ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS expires_at        TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS max_recipients    INTEGER     DEFAULT NULL CHECK (max_recipients IS NULL OR max_recipients > 0);

-- Portalda yaklaşan kampanyaları bulmak için index
CREATE INDEX IF NOT EXISTS idx_campaigns_expires_at
  ON campaigns (business_id, expires_at)
  WHERE expires_at IS NOT NULL AND status IN ('scheduled', 'sending', 'completed');
