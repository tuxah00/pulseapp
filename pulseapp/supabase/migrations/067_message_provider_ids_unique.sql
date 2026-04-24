-- T1.1 — Webhook idempotency
-- messages.meta_message_id ve twilio_sid için partial unique index.
-- Meta/Twilio retry ettiğinde aynı mesaj iki kez insert edilmez;
-- kod seviyesinde .upsert({ onConflict, ignoreDuplicates: true }) ile duplicate atlatılır.

-- NOT: CONCURRENTLY tek statement halinde Supabase Management API üzerinden uygulanır.

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_meta_message_id_unique
  ON messages (meta_message_id)
  WHERE meta_message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_twilio_sid_unique
  ON messages (twilio_sid)
  WHERE twilio_sid IS NOT NULL;

COMMENT ON INDEX idx_messages_meta_message_id_unique IS
  'Meta WhatsApp Cloud API webhook idempotency — aynı wamid ikinci kez insert edilemez.';
COMMENT ON INDEX idx_messages_twilio_sid_unique IS
  'Twilio SMS/WA webhook idempotency — aynı MessageSid ikinci kez insert edilemez.';
