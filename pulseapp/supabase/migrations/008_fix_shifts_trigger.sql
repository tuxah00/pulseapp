-- ================================================
-- 008_fix_shifts_trigger.sql
-- moddatetime extension bağımlılığını kaldır,
-- standart PL/pgSQL trigger ile değiştir
-- ================================================

CREATE OR REPLACE FUNCTION public.update_shifts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS shifts_updated_at ON public.shifts;

CREATE TRIGGER shifts_updated_at
  BEFORE UPDATE ON public.shifts
  FOR EACH ROW EXECUTE FUNCTION public.update_shifts_updated_at();
