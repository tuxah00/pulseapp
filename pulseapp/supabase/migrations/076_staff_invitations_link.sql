-- Migration 076: staff_invitations'a staff_id kolonu ekle
-- Amaç: "Yeni Personel" formundan oluşturulan personel kaydı + davet linki tek akışa indirgenir.
-- Davet token'ı kabul edilince staff_members'da YENİ satır oluşturulmaz; mevcut satırın
-- user_id alanı doldurulur. Böylece duplicate personel sorunu ortadan kalkar.

ALTER TABLE staff_invitations
  ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff_members(id) ON DELETE CASCADE;

-- staff_id dolu olan davetler için index (accept akışında lookup hızlandırır)
CREATE INDEX IF NOT EXISTS idx_staff_invitations_staff_id
  ON staff_invitations(staff_id)
  WHERE staff_id IS NOT NULL;
