-- =============================================
-- 053: follow_up_queue genişletme
-- - appointment_id artık nullable (paket satışı, protokol vb. için)
-- - customer_package_id eklendi (paket satışı takibi)
-- - type CHECK: 'package_sold' tipi eklendi
-- =============================================

-- appointment_id nullable yap
ALTER TABLE follow_up_queue
  ALTER COLUMN appointment_id DROP NOT NULL;

-- paket satışı için FK kolonu
ALTER TABLE follow_up_queue
  ADD COLUMN IF NOT EXISTS customer_package_id UUID REFERENCES customer_packages(id) ON DELETE SET NULL;

-- type CHECK constraint güncelle (önce eskisini düşür, yenisini ekle)
ALTER TABLE follow_up_queue
  DROP CONSTRAINT IF EXISTS follow_up_queue_type_check;

ALTER TABLE follow_up_queue
  ADD CONSTRAINT follow_up_queue_type_check
  CHECK (type IN ('post_session','next_session_reminder','protocol_completion','package_sold','manual'));

-- Ek index
CREATE INDEX IF NOT EXISTS idx_follow_up_queue_package
  ON follow_up_queue(customer_package_id)
  WHERE customer_package_id IS NOT NULL;
