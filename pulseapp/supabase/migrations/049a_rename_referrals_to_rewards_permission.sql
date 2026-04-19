-- 049: staff_members.permissions JSONB içindeki 'referrals' anahtarını 'rewards' olarak yeniden adlandır
-- Sebep: Sidebar ve UI 'Ödüller' üst başlığı altına taşındı; permission key senkron hale getirildi.
-- Tablolar (referrals, rewards) değişmez; sadece JSONB içindeki izin anahtarı taşınır.

UPDATE staff_members
SET permissions = (permissions - 'referrals') || jsonb_build_object('rewards', permissions -> 'referrals')
WHERE permissions ? 'referrals';
