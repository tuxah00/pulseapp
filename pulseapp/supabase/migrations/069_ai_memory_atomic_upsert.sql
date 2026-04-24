-- T1.7 — Memory upsert race condition çözümü
--
-- Migration 061'deki idx_ai_memory_unique functional (COALESCE-based) bir index
-- olduğundan PostgREST onConflict ile doğrudan hedeflenmesi zor. Atomik upsert
-- için dedicated RPC kullanılır: tek SQL statement'ında ON CONFLICT DO UPDATE.
--
-- Confidence max() SQL-side yapılır — eski confidence düşürülmez.

CREATE OR REPLACE FUNCTION upsert_ai_memory(
  p_business_id UUID,
  p_scope TEXT,
  p_scope_id UUID,
  p_key TEXT,
  p_value JSONB,
  p_confidence NUMERIC,
  p_source TEXT,
  p_created_by_staff_id UUID,
  p_expires_at TIMESTAMPTZ
)
RETURNS ai_business_memory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ai_business_memory;
BEGIN
  INSERT INTO ai_business_memory (
    business_id, scope, scope_id, key, value, confidence,
    source, created_by_staff_id, last_reinforced_at, expires_at
  )
  VALUES (
    p_business_id, p_scope, p_scope_id, p_key, p_value, p_confidence,
    COALESCE(p_source, 'explicit_user'), p_created_by_staff_id, now(), p_expires_at
  )
  ON CONFLICT (business_id, scope, COALESCE(scope_id::text, 'null'), key)
  DO UPDATE SET
    value = EXCLUDED.value,
    confidence = GREATEST(ai_business_memory.confidence, EXCLUDED.confidence),
    source = EXCLUDED.source,
    created_by_staff_id = EXCLUDED.created_by_staff_id,
    last_reinforced_at = now(),
    expires_at = EXCLUDED.expires_at,
    updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

COMMENT ON FUNCTION upsert_ai_memory IS
  'AI business memory atomik upsert — race-free. Confidence değeri önceki kaydın max''ı olarak korunur.';
