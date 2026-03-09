-- ============================================
-- Randevu "Tamamlandı" güncellemesinde müşteri segment
-- tip hatasını önlemek için tetikleyici düzeltmesi.
-- Hata: column "segment" is of type customer_segment but expression is of type text
-- ============================================

-- Mevcut tetikleyicileri kaldır (isimler Supabase/dashboard'tan gelebilir)
DO $$
DECLARE
  tr record;
BEGIN
  FOR tr IN
    SELECT tgname FROM pg_trigger t
    WHERE t.tgrelid = 'public.appointments'::regclass
      AND NOT t.tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.appointments', tr.tgname);
  END LOOP;
END $$;

-- Randevu tamamlandığında müşteriyi güncelleyen fonksiyon (segment enum cast ile)
CREATE OR REPLACE FUNCTION public.pulseapp_sync_customer_on_appointment_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
    UPDATE public.customers
    SET
      last_visit_at = (NEW.appointment_date::text || ' ' || COALESCE(NEW.end_time::text, '23:59:59'))::timestamp,
      total_visits = COALESCE(total_visits, 0) + 1
    WHERE id = NEW.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Tetikleyici: randevu güncellendiğinde çalışır
CREATE TRIGGER after_appointment_status_sync_customer
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.pulseapp_sync_customer_on_appointment_completed();
