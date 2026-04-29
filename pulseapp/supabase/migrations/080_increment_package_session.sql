-- Atomik paket seansı artırma — concurrent tıklamaya karşı race condition korunur
-- Eski kod: SELECT sessions_used → newUsed = used+1 → UPDATE — TOCTOU açığı
-- Yeni: tek atomik UPDATE; başarılı satır sayısı 0 ise zaten dolu/yarış kaybı

CREATE OR REPLACE FUNCTION increment_package_session(
  p_package_id uuid,
  p_business_id uuid
)
RETURNS TABLE (
  package_id uuid,
  sessions_used int,
  sessions_total int,
  new_status text,
  was_already_full boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used int;
  v_total int;
  v_status text;
BEGIN
  -- Atomik artış — yalnızca sessions_used < sessions_total ise.
  -- Aynı anda iki tıklama gelirse sadece ilki güncelleyebilir.
  UPDATE customer_packages
  SET sessions_used = sessions_used + 1,
      status = CASE
        WHEN sessions_used + 1 >= sessions_total THEN 'completed'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_package_id
    AND business_id = p_business_id
    AND sessions_used < sessions_total
  RETURNING customer_packages.id, customer_packages.sessions_used,
            customer_packages.sessions_total, customer_packages.status, false
  INTO package_id, sessions_used, sessions_total, new_status, was_already_full;

  -- 0 satır güncellendiyse — paket zaten dolu (race condition kaybı veya tekrar tetikleme)
  IF NOT FOUND THEN
    SELECT id, customer_packages.sessions_used, customer_packages.sessions_total, customer_packages.status
    INTO package_id, sessions_used, sessions_total, new_status
    FROM customer_packages
    WHERE id = p_package_id AND business_id = p_business_id;
    was_already_full := true;
  END IF;

  RETURN NEXT;
END;
$$;

-- Geri alma — sessions_used > 0 ise atomik azaltma
CREATE OR REPLACE FUNCTION decrement_package_session(
  p_package_id uuid,
  p_business_id uuid
)
RETURNS TABLE (
  package_id uuid,
  sessions_used int,
  sessions_total int,
  new_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE customer_packages
  SET sessions_used = GREATEST(0, sessions_used - 1),
      status = CASE
        WHEN status = 'completed' AND sessions_used - 1 < sessions_total THEN 'active'
        ELSE status
      END,
      updated_at = now()
  WHERE id = p_package_id
    AND business_id = p_business_id
  RETURNING customer_packages.id, customer_packages.sessions_used,
            customer_packages.sessions_total, customer_packages.status
  INTO package_id, sessions_used, sessions_total, new_status;

  RETURN NEXT;
END;
$$;
