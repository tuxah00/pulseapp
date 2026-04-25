-- 070_audit_actor_type.sql
-- audit_logs tablosuna actor_type ve actor_id kolonları eklenir.
-- Müşteri portalı eylemlerinin (KVKK silme, profil değişikliği, ödeme) loglanabilmesi için
-- actor_type 'customer' olabilmeli. Mevcut staff kayıtları için varsayılan 'staff'.

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS actor_type text DEFAULT 'staff'
    CHECK (actor_type IN ('staff','customer','system')),
  ADD COLUMN IF NOT EXISTS actor_id uuid;

CREATE INDEX IF NOT EXISTS idx_audit_actor
  ON audit_logs(actor_type, actor_id);
