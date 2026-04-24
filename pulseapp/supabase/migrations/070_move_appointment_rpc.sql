-- 070_move_appointment_rpc.sql
-- Drag-drop randevu taşıma için atomic RPC (TOCTOU koruması)
-- Check-update-recheck pattern'ini değiştirir; advisory lock + FOR UPDATE ile
-- aynı işletme+tarih üzerindeki eşzamanlı taşıma operasyonlarını serileştirir.

CREATE OR REPLACE FUNCTION move_appointment(
  p_appointment_id uuid,
  p_business_id uuid,
  p_new_date date,
  p_new_start time,
  p_new_end time
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_staff_id uuid;
  v_conflict_id uuid;
  v_is_member boolean;
BEGIN
  -- 0. Cross-tenant koruma: çağıran kullanıcı bu işletmeye üye mi?
  -- SECURITY DEFINER olduğu için auth.uid() ile membership kontrol edilir.
  SELECT EXISTS (
    SELECT 1 FROM staff_members
    WHERE user_id = auth.uid() AND business_id = p_business_id
  ) INTO v_is_member;

  IF NOT v_is_member THEN
    RETURN jsonb_build_object('ok', false, 'error', 'forbidden');
  END IF;

  -- 1. Advisory transaction-scoped lock: (business, new_date) üzerinde seri erişim
  -- Aynı işletmenin aynı gününe eş zamanlı tüm drag-drop istekleri burada sıraya girer.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':' || p_new_date::text, 0)
  );

  -- 2. Taşınacak randevuyu lock et ve staff_id'yi çek
  SELECT staff_id INTO v_staff_id
  FROM appointments
  WHERE id = p_appointment_id
    AND business_id = p_business_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_found');
  END IF;

  -- 3. Çakışma kontrolü (aynı personel için, kendisi hariç)
  -- Advisory lock sayesinde bu kontrolle update arasında başka kimse araya giremez.
  IF v_staff_id IS NOT NULL THEN
    SELECT id INTO v_conflict_id
    FROM appointments
    WHERE business_id = p_business_id
      AND staff_id = v_staff_id
      AND appointment_date = p_new_date
      AND id != p_appointment_id
      AND status IN ('pending', 'confirmed')
      AND deleted_at IS NULL
      AND start_time < p_new_end
      AND end_time > p_new_start
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'conflict');
    END IF;
  END IF;

  -- 4. Atomic update
  UPDATE appointments
  SET appointment_date = p_new_date,
      start_time = p_new_start,
      end_time = p_new_end,
      updated_at = now()
  WHERE id = p_appointment_id
    AND business_id = p_business_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- Yalnızca authenticated rol çalıştırabilir; membership kontrolü fonksiyon içinde.
REVOKE ALL ON FUNCTION move_appointment(uuid, uuid, date, time, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION move_appointment(uuid, uuid, date, time, time) TO authenticated;
