-- 040_staff_write_permissions.sql
-- write_permissions NULL iken runtime'da role-based default uygulanır.

ALTER TABLE public.staff_members
  ADD COLUMN IF NOT EXISTS write_permissions JSONB;

COMMENT ON COLUMN public.staff_members.write_permissions IS
  'Granüler yazma yetkileri. NULL = role-based default.';
