-- T3.3 — KVKK cascade audit
-- Müşteri hard-delete olduğunda ilişkili tabloların temizlendiğinden emin olmak için
-- FK'lerde ON DELETE CASCADE zorunluluğu. Mevcut eksiklikler tespit edilip eklenir.
--
-- NOT: Mevcut FK constraint'lerin ON DELETE davranışı CASCADE değilse değiştirmek için
-- constraint drop + re-create gerekir. Supabase'de genelde customers FK'leri
-- CASCADE ile oluşturuluyor; bu migration SELECT ile doğrulama yapar, yoksa düzeltir.
--
-- Çalıştırılacak tablolar:
--   customer_photos, customer_allergies, customer_rewards, treatment_protocols,
--   protocol_sessions (customer üzerinden değil protocol üzerinden), follow_up_queue,
--   referrals (referrer_id, referred_id), consent_records, appointments (soft delete),
--   messages, reviews
--
-- Bu migration idempotent: constraint varsa drop + create, yoksa sadece create.

DO $$
DECLARE
  r RECORD;
  v_table TEXT;
  v_constraint TEXT;
  v_column TEXT;
BEGIN
  -- customers.id'ye FK veren tablolar için ON DELETE davranışını CASCADE'e çek
  FOR r IN
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    JOIN information_schema.constraint_column_usage ccu
      ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'customers'
      AND ccu.column_name = 'id'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.%I DROP CONSTRAINT %I',
      r.table_name, r.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.customers(id) ON DELETE CASCADE',
      r.table_name, r.constraint_name, r.column_name
    );
    RAISE NOTICE 'Cascade eklendi: %.% → customers.id', r.table_name, r.column_name;
  END LOOP;
END $$;

-- Audit sorgusu: kalan non-cascade FK'leri raporla (geliştirici bilgisi)
-- Bu sorgu migration çıktısına basılmaz, manuel kontrol için referans.
-- SELECT tc.table_name, kcu.column_name, rc.delete_rule
-- FROM information_schema.table_constraints tc
-- JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
-- JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
-- WHERE ccu.table_name = 'customers' AND ccu.column_name = 'id';

COMMENT ON SCHEMA public IS
  'KVKK uyumluluk: customers.id''ye FK veren tüm tablolar ON DELETE CASCADE. 070_kvkk_cascade_audit migration''ı ile zorlandı.';
