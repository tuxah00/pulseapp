-- 053_rewards_feature_flag.sql
-- Ödüller sistemi için işletme bazında aç/kapat bayrağı
-- businesses.settings JSONB üzerine rewards_enabled kolonu eklenir (default true)

UPDATE businesses
SET settings = jsonb_set(
  COALESCE(settings, '{}'::jsonb),
  '{rewards_enabled}',
  'true'::jsonb,
  true
)
WHERE NOT (COALESCE(settings, '{}'::jsonb) ? 'rewards_enabled');
