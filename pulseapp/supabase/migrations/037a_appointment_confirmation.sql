-- ============================================
-- 037: Randevu Onay Sistemi & No-Show Yönetimi
-- ============================================

-- Randevuya onay durumu ekleme
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_status TEXT DEFAULT 'none'
  CHECK (confirmation_status IN ('none', 'waiting', 'confirmed_by_customer', 'declined', 'no_response'));

-- Onay SMS'inin gönderildiği zaman
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS confirmation_sent_at TIMESTAMPTZ;

-- Müşteriye no-show skoru ekleme (0-100 arası, yüksek = riskli)
ALTER TABLE customers ADD COLUMN IF NOT EXISTS no_show_score INTEGER DEFAULT 0;

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_appointments_confirmation
  ON appointments (confirmation_status, appointment_date)
  WHERE confirmation_status IN ('waiting', 'no_response');

CREATE INDEX IF NOT EXISTS idx_customers_no_show_score
  ON customers (no_show_score DESC)
  WHERE no_show_score > 0;
