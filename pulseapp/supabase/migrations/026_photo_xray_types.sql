-- customer_photos tablosunun photo_type CHECK constraint'ini genişlet
-- xray (röntgen) ve panoramic (panoramik) tipleri ekleniyor

ALTER TABLE customer_photos DROP CONSTRAINT IF EXISTS customer_photos_photo_type_check;

ALTER TABLE customer_photos
  ADD CONSTRAINT customer_photos_photo_type_check
  CHECK (photo_type IN ('before','after','progress','xray','panoramic'));
