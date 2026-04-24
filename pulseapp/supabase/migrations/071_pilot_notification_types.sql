-- Pilot mode + portal akışları için notification_type enum genişletme.
-- Ayrı migration: ALTER TYPE ADD VALUE aynı transaction'da kullanılamaz.

ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'pilot_message_pending';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'customer_payment_claim';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'reward_redemption_requested';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'customer_feedback';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'automation_run';
