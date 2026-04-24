-- T1.5 — Auto-reply cap race condition çözümü
--
-- Sorun: guardrails.ts count-before-write pattern'i eş zamanlı webhook'larda
-- (SMS + WhatsApp aynı anda) cap atlatmasına yol açıyordu.
--
-- Çözüm: messages tablosu zaten audit trail olduğu için ek tablo gerekmez.
-- Advisory lock ile aynı (business_id, customer_id) için concurrent execution
-- serialize edilir; cooldown + per-customer cap + business cap kontrolleri tek
-- transaction içinde atomik çalışır.
--
-- RPC adı: check_auto_reply_allowed(business_id, customer_id, cooldown_min, per_customer_cap, business_cap)
-- Döner: 'ok' | 'cooldown' | 'per_customer_cap' | 'business_daily_cap'

CREATE OR REPLACE FUNCTION check_auto_reply_allowed(
  p_business_id UUID,
  p_customer_id UUID,
  p_cooldown_minutes INT,
  p_per_customer_cap INT,
  p_business_cap INT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lock_key BIGINT;
  v_now TIMESTAMPTZ := now();
  v_cooldown_since TIMESTAMPTZ := v_now - make_interval(mins => p_cooldown_minutes);
  v_window_start TIMESTAMPTZ := v_now - interval '24 hours';
  v_cooldown_exists BOOLEAN;
  v_customer_count INT;
  v_business_count INT;
BEGIN
  -- Advisory lock: aynı iş + müşteri çifti için concurrent check'leri serialize et.
  -- pg_advisory_xact_lock transaction bitiminde otomatik release olur.
  v_lock_key := hashtextextended(p_business_id::text || ':' || COALESCE(p_customer_id::text, ''), 0);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Cooldown (aynı müşteriye son N dakikada otomatik yanıt gitti mi?)
  SELECT EXISTS(
    SELECT 1 FROM messages
    WHERE business_id = p_business_id
      AND customer_id = p_customer_id
      AND direction = 'outbound'
      AND message_type = 'ai_auto_reply'
      AND created_at >= v_cooldown_since
  ) INTO v_cooldown_exists;

  IF v_cooldown_exists THEN
    RETURN 'cooldown';
  END IF;

  -- Per-customer daily cap
  SELECT COUNT(*) INTO v_customer_count
  FROM messages
  WHERE business_id = p_business_id
    AND customer_id = p_customer_id
    AND direction = 'outbound'
    AND message_type = 'ai_auto_reply'
    AND created_at >= v_window_start;

  IF v_customer_count >= p_per_customer_cap THEN
    RETURN 'per_customer_cap';
  END IF;

  -- Business-wide daily cap
  SELECT COUNT(*) INTO v_business_count
  FROM messages
  WHERE business_id = p_business_id
    AND direction = 'outbound'
    AND message_type = 'ai_auto_reply'
    AND created_at >= v_window_start;

  IF v_business_count >= p_business_cap THEN
    RETURN 'business_daily_cap';
  END IF;

  RETURN 'ok';
END;
$$;

COMMENT ON FUNCTION check_auto_reply_allowed IS
  'Otomatik yanıt cap + cooldown kontrolü — advisory lock ile race-free. ''ok'' dönerse yanıt gönderilebilir; aksi halde dönen string reddetme sebebidir.';

-- Performans: messages tablosunda (business_id, customer_id, direction, message_type, created_at)
-- filtresi hızlansın diye composite index (mevcut değilse ekle).
CREATE INDEX IF NOT EXISTS idx_messages_auto_reply_cap
  ON messages (business_id, customer_id, direction, message_type, created_at DESC)
  WHERE direction = 'outbound' AND message_type = 'ai_auto_reply';
