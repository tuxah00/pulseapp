-- =============================================
-- 036: rewards.type constraint düzeltmesi
-- =============================================
-- Sorun: rewards tablosu migration 035'ten önce manuel oluşturulmuş,
-- constraint 'discount_fixed' içeriyor ama kod 'discount_amount' kullanıyor.
-- Bu migration her iki değeri de kabul edecek şekilde günceller.

ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_type_check;
ALTER TABLE rewards ADD CONSTRAINT rewards_type_check
  CHECK (type IN ('discount_percent','discount_amount','discount_fixed','free_service','points','gift'));
