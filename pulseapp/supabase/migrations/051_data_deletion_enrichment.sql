-- 051_data_deletion_enrichment.sql — Portal üzerinden KVKK hesap silme için ek sütunlar
-- Mevcut data_deletion_requests tablosuna: neden kategorisi, serbest neden, zamanlanmış silme tarihi, kaynak

ALTER TABLE data_deletion_requests
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS reason_category TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_deletion_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'portal';

-- CHECK constraint'lerini güvenli şekilde ekle (varsa geç)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'data_deletion_requests_reason_category_check'
  ) THEN
    ALTER TABLE data_deletion_requests
      ADD CONSTRAINT data_deletion_requests_reason_category_check
      CHECK (reason_category IS NULL OR reason_category IN ('not_using','privacy_concern','switched_provider','dissatisfied','other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'data_deletion_requests_source_check'
  ) THEN
    ALTER TABLE data_deletion_requests
      ADD CONSTRAINT data_deletion_requests_source_check
      CHECK (source IS NULL OR source IN ('portal','staff_manual','email'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_data_deletion_scheduled
  ON data_deletion_requests(scheduled_deletion_at)
  WHERE scheduled_deletion_at IS NOT NULL;

-- status constraint'e 'cancelled' ekle (müşteri 30 gün içinde iptal edebilir)
DO $$
DECLARE
  con_name TEXT;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'data_deletion_requests'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE data_deletion_requests DROP CONSTRAINT %I', con_name);
  END IF;

  ALTER TABLE data_deletion_requests
    ADD CONSTRAINT data_deletion_requests_status_check
    CHECK (status IN ('pending','processing','completed','rejected','cancelled'));
END $$;

CREATE INDEX IF NOT EXISTS idx_data_deletion_business_status
  ON data_deletion_requests(business_id, status);
