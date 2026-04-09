-- Migration 033: Fatura soft delete desteği
-- Hard delete yerine deleted_at timestamp ile işaretleme

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Silinmemiş faturalar için partial index (performans)
CREATE INDEX IF NOT EXISTS idx_invoices_not_deleted ON invoices(business_id, deleted_at) WHERE deleted_at IS NULL;
