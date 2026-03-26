-- Gelir tablosu
CREATE TABLE IF NOT EXISTS income (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  income_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_recurring BOOLEAN DEFAULT false,
  recurring_period TEXT, -- weekly/biweekly/monthly/quarterly/yearly/custom
  custom_interval_days INTEGER, -- Özel tekrar: her kaç günde bir
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "income_select" ON income FOR SELECT USING (true);
CREATE POLICY "income_insert" ON income FOR INSERT WITH CHECK (true);
CREATE POLICY "income_update" ON income FOR UPDATE USING (true);
CREATE POLICY "income_delete" ON income FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_income_business_date ON income(business_id, income_date);

-- Expenses tablosuna özel tekrar aralığı sütunu ekle
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS custom_interval_days INTEGER;
