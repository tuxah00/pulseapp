Veritabanı migration oluştur ve uygula: $ARGUMENTS

Adımlar:
1. Mevcut migration'ları oku: `supabase/migrations/` klasöründeki son dosyaya bak
2. Yeni migration dosyası oluştur: `supabase/migrations/0XX_[açıklama].sql`
   Kurallar:
   - `CREATE TABLE IF NOT EXISTS` kullan (idempotent)
   - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` kullan
   - `CREATE INDEX IF NOT EXISTS` kullan
   - `DROP POLICY IF EXISTS` → sonra `CREATE POLICY` (policy'ler idempotent değil)
   - Her tablo için RLS etkinleştir: `ALTER TABLE x ENABLE ROW LEVEL SECURITY`
   - RLS policy'ler: SELECT/INSERT/UPDATE/DELETE için ayrı ayrı yaz
   - `business_id` filtresi: `USING (business_id = (SELECT business_id FROM staff_members WHERE user_id = auth.uid()))`
   - SECURITY DEFINER fonksiyonlara dikkat: search_path'i açıkça belirt
3. `types/index.ts` içindeki ilgili interface'leri güncelle
4. İlgili API route'larını güncelle (yeni sütunları handle et)
5. Migration SQL'ini kullanıcıya ver ve Supabase SQL Editor'de çalıştırmasını söyle
6. Commit: `chore: add migration [açıklama]`
