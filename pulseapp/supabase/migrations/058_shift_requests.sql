-- =============================================
-- 058: shift_requests — Vardiya talep sistemi
-- Personel vardiya talebini gönderir, yönetici onaylar.
-- Onaylanan talep otomatik shift kaydına dönüşür.
-- =============================================

CREATE TABLE IF NOT EXISTS shift_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id        UUID NOT NULL REFERENCES staff_members(id) ON DELETE CASCADE,
  staff_name      TEXT NOT NULL,
  requested_date  DATE NOT NULL,
  requested_start TIME,
  requested_end   TIME,
  shift_type      TEXT NOT NULL DEFAULT 'regular'
                    CHECK (shift_type IN ('regular','off','part_time')),
  notes           TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  reviewed_by     UUID REFERENCES staff_members(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_shift_requests_business
  ON shift_requests(business_id, status, requested_date);

CREATE INDEX IF NOT EXISTS idx_shift_requests_staff
  ON shift_requests(staff_id, status);

-- RLS
ALTER TABLE shift_requests ENABLE ROW LEVEL SECURITY;

-- Personel kendi taleplerini görebilir ve oluşturabilir
CREATE POLICY "shift_requests_staff_select" ON shift_requests
  FOR SELECT USING (
    staff_id IN (
      SELECT id FROM staff_members WHERE user_id = auth.uid()
    )
    OR
    business_id IN (
      SELECT business_id FROM staff_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "shift_requests_staff_insert" ON shift_requests
  FOR INSERT WITH CHECK (
    staff_id IN (
      SELECT id FROM staff_members WHERE user_id = auth.uid()
    )
  );

-- Yönetici/sahip güncelleme yapabilir (onay/red)
CREATE POLICY "shift_requests_manager_update" ON shift_requests
  FOR UPDATE USING (
    business_id IN (
      SELECT business_id FROM staff_members
      WHERE user_id = auth.uid()
      AND role IN ('owner','manager')
    )
  );

-- Herkes kendi talebini silebilir (sadece pending)
CREATE POLICY "shift_requests_delete" ON shift_requests
  FOR DELETE USING (
    staff_id IN (
      SELECT id FROM staff_members WHERE user_id = auth.uid()
    )
    AND status = 'pending'
  );
