Yeni bir özellik ekle: $ARGUMENTS

Adımlar:
1. `types/index.ts` dosyasını oku → gerekli yeni interface/type'ları ekle
2. Supabase migration SQL'i yaz → `supabase/migrations/` altında yeni dosya oluştur (IF NOT EXISTS + IF NOT EXISTS policy kullan)
3. API route oluştur: `app/api/[feature]/route.ts` — GET/POST/PATCH/DELETE gerektiği kadar
   - GET: createServerSupabaseClient + createAdminClient kullan
   - Yetki kontrolü: her endpoint'te `supabase.auth.getUser()` ile kullanıcı doğrula
   - RLS: business_id filtresi ekle
4. Sayfa oluştur: `app/dashboard/[feature]/page.tsx`
   - `'use client'` directive
   - `useBusinessContext()` hook ile businessId/permissions al
   - Permission kontrolü ekle (permissions.[feature] yoksa erişim engel mesajı)
   - Loading state, empty state (`EmptyState` bileşeni), hata state
   - Tüm UI metinleri Türkçe
   - Dark mode için `dark:` prefix'li Tailwind class'ları
   - Modal'larda `modal-overlay` + `modal-content` class'larını kullan
   - Silme işlemleri için `useConfirm()` hook kullan (browser confirm() KULLANMA)
5. Sidebar'a ekle: `lib/config/sector-modules.ts` → ilgili sektör(ler)e item ekle
6. Permission'a ekle: `types/index.ts` StaffPermissions interface + `components/dashboard/sidebar.tsx` PERMISSION_MAP
7. Audit log ekle: create/update/delete işlemlerinde `logAudit()` çağır
8. Build kontrol: `cd pulseapp && npx tsc --noEmit`
9. Commit: `feat: [özellik adı]`
10. Push: `git push`
