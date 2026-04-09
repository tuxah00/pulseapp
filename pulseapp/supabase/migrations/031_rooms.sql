-- Migration 031: Tedavi odaları (Oda Takvimi görünümü için)

CREATE TABLE IF NOT EXISTS rooms (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  capacity    INT DEFAULT 1,
  color       TEXT DEFAULT '#6366f1',
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- appointments tablosuna oda FK'si ekle
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id) ON DELETE SET NULL;

-- İndeksler
CREATE INDEX IF NOT EXISTS idx_rooms_business ON rooms (business_id, is_active);
CREATE INDEX IF NOT EXISTS idx_appointments_room ON appointments (room_id) WHERE room_id IS NOT NULL;

-- RLS
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rooms_select" ON rooms
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = rooms.business_id
        AND staff_members.is_active = true
    )
  );

CREATE POLICY "rooms_insert" ON rooms
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = rooms.business_id
        AND staff_members.is_active = true
    )
  );

CREATE POLICY "rooms_update" ON rooms
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = rooms.business_id
        AND staff_members.is_active = true
    )
  );

CREATE POLICY "rooms_delete" ON rooms
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM staff_members
      WHERE staff_members.user_id = auth.uid()
        AND staff_members.business_id = rooms.business_id
        AND staff_members.is_active = true
    )
  );
