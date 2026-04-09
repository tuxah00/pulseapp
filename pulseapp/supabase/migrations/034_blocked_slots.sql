-- Bloklanmış zaman dilimleri: randevu alınamayacak saatler
CREATE TABLE IF NOT EXISTS blocked_slots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES staff_members(id) ON DELETE CASCADE,
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE blocked_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_slots_select" ON blocked_slots
  FOR SELECT USING (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

CREATE POLICY "blocked_slots_insert" ON blocked_slots
  FOR INSERT WITH CHECK (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

CREATE POLICY "blocked_slots_delete" ON blocked_slots
  FOR DELETE USING (
    business_id IN (SELECT business_id FROM staff_members WHERE user_id = auth.uid())
  );

CREATE INDEX idx_blocked_slots_business_date ON blocked_slots(business_id, date);
CREATE INDEX idx_blocked_slots_staff ON blocked_slots(staff_id) WHERE staff_id IS NOT NULL;
CREATE INDEX idx_blocked_slots_room ON blocked_slots(room_id) WHERE room_id IS NOT NULL;
