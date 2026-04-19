-- Akıllı Boşluk Doldurma: iptal edilen randevu slotları için gönderilen bildirimler
-- Aynı slot için aynı müşteriye max 1 bildirim garantisi sağlar

CREATE TABLE IF NOT EXISTS gap_fill_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- appointment_id soft ref: randevu silinse bile log korunur
  appointment_id UUID NOT NULL,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  slot_date DATE NOT NULL,
  slot_start_time TEXT NOT NULL,
  service_id UUID REFERENCES services(id) ON DELETE SET NULL,
  staff_id UUID REFERENCES staff_members(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'history' CHECK (source IN ('waitlist', 'history')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, customer_id, slot_date, slot_start_time)
);

CREATE INDEX IF NOT EXISTS idx_gap_fill_notifications_business_id
  ON gap_fill_notifications(business_id);

CREATE INDEX IF NOT EXISTS idx_gap_fill_notifications_slot
  ON gap_fill_notifications(slot_date, slot_start_time);

ALTER TABLE gap_fill_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "gap_fill_service_role" ON gap_fill_notifications
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "gap_fill_staff_all" ON gap_fill_notifications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM staff_members sm
      WHERE sm.business_id = gap_fill_notifications.business_id
        AND sm.user_id = auth.uid()
    )
  );
