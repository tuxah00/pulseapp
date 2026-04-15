-- ================================================
-- 040_staff_write_permissions.sql
-- Personel için granüler "Düzenle" yetkileri
-- Mevcut permissions kolonu "Görüntüle" anlamında kalır.
-- write_permissions NULL ise runtime'da role-based default kullanılır.
-- ================================================

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS write_permissions JSONB;

CREATE INDEX IF NOT EXISTS idx_staff_members_write_permissions
  ON public.staff_members USING gin (write_permissions);

COMMENT ON COLUMN public.staff_members.write_permissions IS
  'Granüler yazma yetkileri. NULL = role-based default. Yapı: { appointments: true, customers: false, ... }';
