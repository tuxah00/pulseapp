-- ============================================
-- 036: Referans durum sadeleştirmesi
-- pending | converted | expired → pending | rewarded
-- ============================================

-- 1) Mevcut 'converted' kayıtları 'rewarded' yap
UPDATE referrals SET status = 'pending' WHERE status IN ('converted', 'expired');

-- 2) CHECK constraint'i güncelle
ALTER TABLE referrals DROP CONSTRAINT IF EXISTS referrals_status_check;
ALTER TABLE referrals ADD CONSTRAINT referrals_status_check CHECK (status IN ('pending', 'rewarded'));
