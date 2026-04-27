# PulseApp — Claude Code Proje Rehberi

## Proje Özeti
PulseApp, çok sektörlü SaaS işletme yönetim platformu. Next.js 14, Supabase, Tailwind CSS, TypeScript.

## Marka Rengi (Primary Brand Color)
- **Lacivert / Navy:** `#193d8f` = Tailwind `pulse-900`
- Bu renk tüm birincil UI elemanlarında kullanılır: btn-primary, sidebar aktif durumu, avatar arka planları
- Yeni buton/link/highlight eklerken `pulse-500` (parlak mavi) değil `pulse-900` (lacivert) kullan
- Açık mod ve karanlık mod: her ikisinde de aynı lacivert, yalnızca dark modda `pulse-300` veya `pulse-400` text variant kullanılır

## Branch Çalışma Kuralı (KESİNLİKLE UYULMALI)

### Temel Prensipler
- Her session'ın **bir planı** vardır (sprint, özellik, düzeltme vb.).
- O plana göre **bir branch adı** belirlenir: `feature/[plan-konusu]`
- Session boyunca **yalnızca o branch'e** push yapılır.
- **HİÇBİR ZAMAN `origin/main`'e doğrudan push yapılmaz.**

### Branch İsimlendirme Kuralı
Branch adı session'ın planını yansıtır:

| Plan / Konu | Branch Adı |
|-------------|-----------|
| **Aktif geliştirme (yeni özellikler, planlar)** | `gelecek-ozellik-plan` ← varsayılan |
| Canlıya çıkış hazırlığı | `feature/launch-prep` |
| Faz 3 — Skill paketleri | `feature/faz3-skill-packages` |
| Hata düzeltme | `fix/[konu]` |
| Refactor / temizlik | `refactor/[konu]` |

### Yeni Session Başlarken
1. Kullanıcı planı/konuyu söyler.
2. O konuya uygun branch adı belirlenir ve kullanıcıya bildirilir.
3. Branch yoksa oluşturulur (`git checkout -b feature/[konu]`), varsa geçilir.
4. Tüm commitler ve push'lar **yalnızca o branch'e** yapılır.

### Commit & Push
```
git push origin HEAD:refs/heads/feature/[konu]
```

### Maine Aktarma (yalnızca kullanıcı "maine aktar" dediğinde)
1. Main'e merge:
   ```
   git push origin HEAD:main
   ```
2. Diğer aktif branch'leri main ile eşitle:
   ```
   git fetch origin
   git push origin origin/main:refs/heads/feature/[diğer-branch]
   ```

## Ertelenen Kurulumlar (Pilot Müşteri Gelince Hatırlat)

| Kurulum | Neden | Ne Yapılacak |
|---------|-------|-------------|
| **Sentry** | Hata takip servisi — canlıda hata olunca e-posta/bildirim gönderir | [sentry.io](https://sentry.io)'dan ücretsiz hesap aç → DSN al → Vercel'e `NEXT_PUBLIC_SENTRY_DSN` ekle. Kod hazır, sadece env değişkeni eksik. |

---

## Deploy
- **GitHub repo:** tuxah00/pulseapp
- **Vercel:** main branch'e her push'ta otomatik deploy
- **Kural:** commit → branch'e push → kullanıcı test → "maine aktar" onayı → main'e merge

## Supabase Migration Kuralı
- **Migration dosyası oluşturduktan sonra Supabase Management API ile otomatik olarak çalıştır**
- Endpoint: `POST https://api.supabase.com/v1/projects/dtahmvtmwtqodgypvopn/database/query`
- Auth: `Bearer $SUPABASE_PAT` — token `.env.local`'den okunur (`SUPABASE_PAT` key'i), **asla CLAUDE.md'ye veya git'e yazılmaz**
- Node.js ile her SQL statement'ı ayrı ayrı gönder (tek request'te birden fazla statement hata verebilir)
- Başarılı response: HTTP 201, body `[]`
- Migration çalıştırıldıktan sonra `CLAUDE.md` SQL Migration Gereksinimleri bölümüne ekle

## Git Commit Formatı
```
<type>: <Türkçe açıklama>

Co-Authored-By: Claude Code <noreply@anthropic.com>
```
**type değerleri:** `feat` (yeni özellik) | `fix` (hata düzeltme) | `refactor` (yapısal değişiklik) | `chore` (config/bağımlılık) | `docs` (dokümantasyon)

Örnekler:
- `feat: randevu tekrarlama özelliği eklendi`
- `fix: haftalık takvimde 08:00 çizgisi çakışması giderildi`
- `refactor: confirm() çağrıları useConfirm() ile değiştirildi`

## Soru Sorma Kuralı
- Kullanıcıya soru sorulması gerektiğinde **AskUserQuestion** tool formatında sorulmalı (düz metin değil).
- Çoktan seçmeli, kısa, net seçenekler sun (her seçenek için 1-2 cümle açıklama).
- "Devam edelim mi?" gibi onay soruları yerine somut çözüm yolları arasında seçim yaptır.
- Sorun anlaşılmıyorsa: anlamak için sor. Çözüm yolları arasında karar veriliyorsa: alternatifleri sun.

## Türkçe UI Kuralı
- **Tüm kullanıcıya görünen metinler Türkçe olmalı:** buton etiketleri, placeholder'lar, hata mesajları, boş durum mesajları, tooltip'ler
- Kod içi değişken/fonksiyon isimleri İngilizce kalır
- API response key'leri İngilizce kalır
- Tarih formatı: `tr-TR` locale kullan (`toLocaleDateString('tr-TR', ...)`)
- Para birimi: Türk Lirası (₺), `formatCurrency()` helper kullan (`lib/utils.ts`)

## Teknik Stack
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, TypeScript
- **Backend:** Supabase (PostgreSQL + RLS + Realtime)
- **Auth:** Supabase Auth → staff_members tablosu ile işletmeye bağlı
- **AI:** OpenAI API (`gpt-4o-mini`) via `openai` SDK (tek motor — maliyet optimizasyonu)
- **Model:** `lib/ai/openai-client.ts` → `getOpenAIClient()`, `ASSISTANT_MODEL`, `CLASSIFY_MODEL`, `REPLY_MODEL`, `VISION_MODEL`, `EMBEDDING_MODEL`

## Supabase Patterns
```ts
// Client-side (page components):
import { createClient } from '@/lib/supabase/client'

// Server-side (API routes, Server Components):
import { createServerSupabaseClient } from '@/lib/supabase/server'

// Admin (bypass RLS - webhook/cron/invite):
import { createAdminClient } from '@/lib/supabase/admin'
```

## Business Context
```ts
// Provider: lib/hooks/business-context-provider.tsx
// Hook: lib/hooks/use-business-context.ts
const { businessId, userId, staffId, staffName, staffRole, permissions, sector, loading } = useBusinessContext()
```

## Sektör Sistemi
- **Config:** `lib/config/sector-modules.ts`
- `getSidebarSections(sector, plan)` → sidebar items
- `getCustomerLabel(sector)` → sektöre göre müşteri etiketi (Danışanlar/Hastalar/Müvekkiller vb.)
- 20+ sektör destekleniyor: `SectorType` in `types/index.ts`

## Yetki Sistemi
- `StaffPermissions` interface: `types/index.ts`
- `DEFAULT_PERMISSIONS` per role (owner/manager/staff)
- `getEffectivePermissions(role, customPermissions)` → override mekanizması
- `staff_members.permissions` JSONB kolonu (null = role default kullan)
- Sidebar'da `PERMISSION_MAP` ile route→permission eşlemesi

## Audit Logging
- Tablo: `audit_logs` (business_id, staff_id, staff_name, action, resource, resource_id, details, ip_address)
- Helper: `lib/utils/audit.ts` → `logAudit(params)`
- API: `/api/audit` — GET (list, owner only), POST (log action)
- IP adresi otomatik olarak `x-forwarded-for` header'dan alınır
- Loglanan eylemler: `create | update | delete | status_change | send | pay | cancel`
- Loglanan kaynaklar: `appointment, customer, staff, permissions, service, settings, expense, invoice, stock_movement, patient_record, message, portfolio, membership, shift, inventory`
- logAudit çağrıları şu sayfalarda mevcut: appointments, customers, analytics (gider), portfolio, invoices, stoklar, records, settings/services, settings/staff, settings/vardiye, settings/business, messages

## Güvenlik Kuralları
- **SOFT DELETE:** Randevular `deleted_at` sütunu ile silinir — hard delete YOK. Tüm appointment sorguları `.is('deleted_at', null)` filtresi içermeli
- **RLS:** Tüm tablolarda Row Level Security aktif — `business_id` bazlı izolasyon
- **Kimlik doğrulama:** Her API endpoint'te `supabase.auth.getUser()` ile kullanıcı kontrolü yap; yoksa 401 dön
- **Admin client:** `createAdminClient()` sadece RLS bypass gerektiğinde kullanılır (webhook, davet, storage upload). Normal CRUD işlemleri için KULLANMA
- **SECURITY DEFINER:** Supabase fonksiyonlarında `SECURITY DEFINER` kullanıyorsan `SET search_path = public` ekle (injection riski)
- **Input validation:** API route'larında zorunlu alanları kontrol et, eksikse 400 dön
- **XSS:** Kullanıcı girdisini doğrudan `dangerouslySetInnerHTML` ile render ETME
- **`staff_invitations`** tablosu ile davet linki sistemi (7 gün geçerli, tek kullanımlık token)

## Önemli Tablolar
| Tablo | Açıklama |
|-------|---------|
| `businesses` | İşletme kayıtları |
| `staff_members` | Personel + yetki (user_id → auth.uid()) |
| `appointments` | Randevular (deleted_at soft delete, manage_token public link) |
| `customers` | Müşteriler (segment: new/regular/vip/risk/lost) |
| `services` | Hizmetler |
| `notifications` | Bildirimler (is_read, type) |
| `audit_logs` | Denetim kaydı (sadece owner görür) |
| `staff_invitations` | Davet linkleri (token, expires_at) |
| `business_records` | Dosya kayıtları (diş/psikolog/klinik vb.) |
| `orders` | Siparişler (restoran/kafe sektörü) |
| `table_reservations` | Masa rezervasyonları |
| `treatment_protocols` | Tedavi protokolleri (seans sayısı, aralık, durum) |
| `protocol_sessions` | Protokol seansları (planned/completed/skipped) |
| `customer_photos` | Öncesi/sonrası fotoğraflar (Supabase Storage URL) |
| `customer_allergies` | Müşteri alerjileri (allergen, severity) |
| `service_contraindications` | Hizmet-alerjen uyumsuzlukları |
| `referrals` | Müşteri tavsiye sistemi (referrer → referred, ödül) |
| `rewards` | Ödül şablonları (indirim, ücretsiz hizmet, puan, hediye) |
| `customer_rewards` | Müşteriye atanmış ödüller (pending/used/expired) |
| `follow_up_queue` | Seans sonrası takip kuyruğu (scheduled_for, status) |

## Dark Mode Stratejisi
- `globals.css`'te `.dark .bg-white`, `.dark .text-gray-900`, `.dark .bg-gray-100` vb. agresif global `!important` override'lar mevcut — bunlar `@layer base` içinde
- Colored badge'ler için semi-transparent dark variants: `.dark .bg-blue-100 { background-color: rgba(59,130,246,0.15) !important }` vb.
- Custom input alanları (`.input` class kullanmayanlar) explicit `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600` almalı
- Modal/dialog arka planları: `dark:bg-gray-900`
- **Tema toggle:** `components/dashboard/top-bar.tsx`'te Sun/Moon butonu (notification bell'in solunda)
- Settings sayfasından tema toggle kaldırıldı

## Modal & Z-Index Standardı
- **Dialog/DialogOverlay:** `z-[60]` (`components/ui/dialog.tsx`)
- **Inline modal backdrop'lar:** `z-[60]` (`fixed inset-0 bg-black/40 z-[60]`)
- **ConfirmDialog:** `z-[110]` / `z-[111]` (`components/ui/confirm-dialog.tsx`) — tüm modal/panellerin üstünde
- **Lightbox (resim görüntüleyici):** `z-[70]` (modal'ların üstünde)
- **TopBar:** `sticky top-0 z-30` — modal overlay'ler bunun üstünde olmalı
- **Sidebar mobile:** `z-40` / `z-50`
- Yeni modal oluştururken `z-50` KULLANMA — her zaman `z-[60]` kullan

## Çalışma Saatleri Validasyonu
- **Admin randevu formu:** `generateTimeSlots(date, workingHours)` ile çalışma saatlerine göre slot üretir
- **Booking API:** `POST /api/book` çalışma saati dışı randevu → 400 hatası döner
- **Public booking:** `book/[businessId]/page.tsx` zaten enforce eder
- **Kapalı gün:** `workingHours[dayKey] === null` → slot yok, "Bu gün kapalıdır" mesajı
- Yeni randevu oluşturma akışı eklenirken mutlaka çalışma saati kontrolü yapılmalı

## Hasta Dosyaları (Records) Pattern
- **Lightbox:** `ImageLightbox` bileşeni `records/page.tsx` içinde tanımlı — resim tıklandığında sayfa içi görüntüleme
- **Created-by:** `data.created_by_staff_id` + `data.created_by_staff_name` JSONB data'da saklanır
- **File metadata:** `data.file_metadata[]` = `{ name, size, type, uploadedAt }` — upload API'den dönen metadata
- **TYPE_CONFIG:** Her kayıt tipinin dinamik alanları burada tanımlı — yeni alan eklerken bu config'e ekle

## UI Border-Radius Standardı
- **Card/Dialog:** `rounded-xl`
- **Button/Input:** `rounded-lg`
- **Badge:** `rounded-full`
- **Avatar (list):** `rounded-xl`, **Avatar (box):** `rounded-full`, **Avatar (detail):** `rounded-2xl`

## Cursor & Seçim Kuralı
- `.card` class'ı `cursor-default` içerir — bilgi kutularında metin imleci (I-beam) görünmez, normal ok imleci çıkar
- Yeni bilgi kutuları/card'lar oluştururken `.card` class'ını kullan veya `cursor-default` ekle
- `select-none` KULLANILMAMALI — kullanıcı sürükleyerek metin seçip kopyalayabilmeli
- `pointer-events-none` yalnızca dekoratif/grafik elementlerde (sparkline, arka plan deseni vb.) kullanılmalı

## Proaktif Dark Mode Kuralı — KESİNLİKLE UYULMALI
Her yeni bileşen veya sayfa yazıldığında KULLANICININ SÖYLEMESİNE GEREK KALMADAN şunlar kontrol edilmeli:

1. **Renk çakışması testi**: Her yeni UI elemanı için hem light hem dark modda `bg-`, `text-`, `border-` renklerinin okunabilir olduğunu zihinsel olarak doğrula
2. **Hover state'leri**: `hover:bg-gray-50`, `hover:bg-white` gibi hover class'ları dark modda `#1f2937` veya `#111827`'ye döner — eğer kart/panel arka planı zaten dark ise metin okunmaz hale gelir
3. **Input/select elemanları**: `.input` class kullanmayan her form elemanı explicit `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600` almalı
4. **Badge ve durum renkleri**: Açık renkli badge'ler (bg-blue-100, bg-green-100 vb.) dark modda semi-transparent olmalı: `dark:bg-blue-900/30 dark:text-blue-300`
5. **CSS @layer spesifite kuralı**: `globals.css`'teki dark mode override'ları `@layer base` içinde. Bunları geçmek için ya `@layer base` içine (dark mode kurallarından sonra) ekle ya da `.dark .booking-page .xyz` gibi daha spesifik (0,3,0) selector kullan
6. **Public sayfalar**: `.portal-layout` ve `.public-page` class'lı sayfalar light modda kalır (bkz. `globals.css`). `booking-page` artık dark mode destekliyor — `dark:` prefix'li Tailwind class'ları kullan.

**Kural**: Herhangi bir sayfada veya bileşende dark mode sorunu görürsen (hover çakışması, metin görünmez, kart çok koyu/açık), bunu kullanıcı söylemeden tespit edip düzelt.

## Modal Animasyonları & ESC
- **Tek animasyon sistemi:** `globals.css` → `.modal-overlay` (fadeIn 0.15s), `.modal-content` (scaleIn 0.2s), `.slide-panel` (slideInRight 0.2s)
- **Kapanma animasyonu:** `.closing` class VEYA `[data-closed]` attribute ile tetiklenir (her ikisi de desteklenir)
- **Dialog bileşeni (`components/ui/dialog.tsx`)** aynı CSS animasyonlarını kullanır: Backdrop'a `modal-overlay`, Popup'a `modal-content` class verilir. Base UI `data-closed` attribute'u eklediğinde globals.css'teki kapanma animasyonu tetiklenir
- **Tailwindcss-animate KULLANILMAMALI:** `animate-in`, `fade-in-0`, `zoom-in-95` gibi tailwindcss-animate class'ları modal'larda KULLANILMAZ — tüm modal'lar globals.css'teki `fadeIn`/`scaleIn` keyframe'leri ile tutarlı animasyon alır
- Custom modal oluştururken: backdrop div'e `modal-overlay`, içerik kartına `modal-content` class ekle
- Kapanma pattern (custom modal): `closing` state → `.closing` CSS class ekle → `onAnimationEnd` ile unmount
- ESC ile kapatma: `useEffect(() => { if (!show) return; const h = (e) => { if (e.key === 'Escape') setShow(false) }; document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h) }, [show])`

## Onay Dialog Sistemi (ConfirmDialog)
- **Provider:** `lib/hooks/use-confirm.tsx` → `ConfirmProvider` (layout.tsx'te wrap edilmiş)
- **Hook:** `useConfirm()` → `confirm({ title, message, confirmText?, cancelText?, variant? }): Promise<boolean>`
- **Bileşen:** `components/ui/confirm-dialog.tsx` — animasyonlu, danger/warning variant'lı
- **Kullanım:** Tüm silme/iptal işlemlerinde browser `confirm()` yerine `await confirm({...})` kullanılır
- **Variant:** `'danger'` (kırmızı, Trash2 icon) | `'warning'` (sarı, AlertTriangle icon)

## Ortak Bileşenler & Hook'lar
- **EmptyState:** `components/ui/empty-state.tsx` — icon, title, description, action props
- **ConfirmDialog:** `components/ui/confirm-dialog.tsx` — onay popup bileşeni
- **useDebounce:** `lib/hooks/use-debounce.ts` — arama input'larında 300ms debounce (customers, stoklar, messages, records, memberships, invoices sayfalarında kullanılıyor)
- **Required field:** `.label-required::after { content: ' *'; color: #ef4444; }` — zorunlu alan etiketi

## SQL Migration Gereksinimleri
Supabase'de çalıştırılmış olması gereken SQL'ler:
1. `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`
2. `CREATE TABLE IF NOT EXISTS audit_logs (...)`
3. `CREATE TABLE IF NOT EXISTS staff_invitations (...)`
4. `ALTER TABLE business_records ADD COLUMN IF NOT EXISTS file_urls jsonb DEFAULT '[]';`
5. `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;`
6. `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_pattern jsonb;`
7. **Mesajlarda personel takibi:**
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff_members(id);
ALTER TABLE messages ADD COLUMN IF NOT EXISTS staff_name TEXT;
CREATE INDEX IF NOT EXISTS idx_messages_staff_id ON messages(staff_id);
```
8. **Gelir tablosu + Gider özel tekrar:**
```sql
-- supabase/migrations/015_create_income.sql dosyasını çalıştırın
```
9. **Birthday automation index** (`017_birthday_automation.sql`): ✅ Uygulandı (2026-04-04)
```sql
CREATE INDEX IF NOT EXISTS idx_customers_birthday ON customers (birthday) WHERE birthday IS NOT NULL;
```

10. **POS / Kasa modülü** (`018_create_pos.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- pos_transactions ve pos_sessions tabloları, RLS policy'leri ve index'ler
```

11. **Fatura ödeme geçmişi + genişletme** (`019_invoice_payments.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- invoice_payments tablosu (ödeme geçmişi), invoices tablosuna paid_amount, pos_transaction_id,
-- staff_id, staff_name, payment_type, installment_count, installment_frequency kolonları
```

12. **Tedavi protokolleri + seans takibi** (`020_treatment_protocols.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- treatment_protocols ve protocol_sessions tabloları, RLS, trigger
```

13. **Müşteri fotoğraf galerisi** (`021_customer_photos.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- customer_photos tablosu, Supabase Storage entegrasyonu
```

14. **Alerji & kontrendikasyon** (`022_allergies.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- customer_allergies ve service_contraindications tabloları
```

15. **Referans/tavsiye sistemi** (`023_referrals.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- referrals tablosu, ödül takibi
```

16. **Randevu yönetim token + takip kuyruğu** (`024_appointment_manage_token.sql`): ✅ Uygulandı (2026-04-04)
```sql
-- appointments.manage_token, follow_up_queue tablosu
```

17. **Diş haritası** (`025_tooth_records.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- tooth_records tablosu, RLS, trigger
```

18. **Fotoğraf röntgen tipleri** (`026_photo_xray_types.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- customer_photos.photo_type CHECK constraint genişletme (xray, panoramic)
```

19. **WhatsApp geliştirmeleri** (`027_whatsapp_enhancements.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- customers.preferred_channel kolonu (sms/whatsapp/auto)
```

20. **KVKK uyumluluk** (`028_kvkk_compliance.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- consent_records, data_deletion_requests tabloları
```

21. **Faturalama altyapısı** (`029_billing.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- payments tablosu (PayTR), businesses billing alanları, invoices e-fatura alanları
```

22. **Tedavi odaları** (`031_rooms.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- rooms tablosu, appointments.room_id FK, RLS
```

23. **KVKK uyumluluk v2** (`032_kvkk_compliance.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- consent_records, data_deletion_requests güncel versiyon (028 yerine kullan)
```

24. **Fatura soft delete** (`033_invoice_soft_delete.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- invoices.deleted_at kolonu, partial index
```

25. **Bloklanmış zaman dilimleri** (`034_blocked_slots.sql`): ✅ Uygulandı (2026-04-09)
```sql
-- blocked_slots tablosu (randevu alınamayacak saatler), RLS, index'ler
```

26. **Ödül şablonları & müşteri ödülleri** (`035_rewards.sql`): ✅ Uygulandı (2026-04-04, tablo manuel oluşturulmuş)
```sql
-- rewards, customer_rewards tabloları, RLS, index'ler
-- referrals.reward_type constraint güncelleme (gift eklendi)
-- referrals.status constraint güncelleme (rewarded eklendi)
```

26-b. **Rewards type constraint düzeltmesi** (`036_fix_rewards_type_constraint.sql`): ✅ Uygulandı (2026-04-11)
```sql
-- rewards.type constraint'ine discount_amount eklendi (DB'de discount_fixed vardı, kod discount_amount kullanıyor)
```

27. **Randevu onay & no-show** (`037_appointment_confirmation.sql`): ✅ Uygulandı (2026-04-12)
```sql
-- appointments.confirmation_status, confirmation_sent_at, customers.no_show_score
```

28. **Periyodik kontrol hatırlatıcı** (`038_periodic_reminders.sql`): ✅ Uygulandı (2026-04-12)
```sql
-- services.recommended_interval_days, periodic_reminders_sent tablosu
```

29. **Kampanya Yöneticisi** (`039_campaigns.sql`): ✅ Uygulandı (2026-04-12)
```sql
-- campaigns tablosu (segment_filter JSONB, status machine, stats), campaign_recipients tablosu, RLS
```

30. **Sektör enum genişletme** (yoga_pilates, spa_massage vb. için):
```sql
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'spa_massage';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'yoga_pilates';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'tattoo_piercing';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'fitness';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'medical_aesthetic';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'car_wash';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'photo_studio';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'dietitian';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'tutoring';
```

31. **AI zamanlanmış eylemler** (`048_ai_scheduled_actions.sql`): ✅ Uygulandı (2026-04-15)
```sql
-- ai_pending_actions: scheduled_for TIMESTAMPTZ, recurrence_rule JSONB kolonları
-- status CHECK genişletildi: 'scheduled' ve 'failed' eklendi
-- idx_ai_pending_actions_scheduled partial index (status='scheduled')
```

32. **Mesaj şablon metadata** (`059_messages_template_meta.sql`): ✅ Uygulandı (2026-04-22)
```sql
-- messages.template_name TEXT, messages.template_params JSONB kolonları
-- idx_messages_template_name partial index (business_id, template_name) WHERE template_name IS NOT NULL
```

33. **Fotoğraf AI analizi + portfolio yayımlama** (`060_photo_ai_analysis.sql`): ✅ Uygulandı (2026-04-22)
```sql
-- customer_photos.ai_analysis JSONB (AI karşılaştırma cache)
-- customer_photos.is_public BOOLEAN (portfolio yayım bayrağı)
-- customer_photos.pair_id UUID (non-FK before/after eşleştirme; session_id protocol_sessions FK'sı olduğu için staff upload'unda kullanılamıyor)
-- idx_customer_photos_public partial index (business_id) WHERE is_public = true
-- idx_customer_photos_pair partial index (pair_id) WHERE pair_id IS NOT NULL
-- customer_photos_public_read RLS policy (anon SELECT — is_public = true)
```

34. **Kampanya attribution** (`066b_campaign_attribution.sql`): ✅ Uygulandı (2026-04-24)
```sql
-- appointments.campaign_id UUID FK → campaigns(id) ON DELETE SET NULL
-- appointments.campaign_recipient_id UUID FK → campaign_recipients(id) ON DELETE SET NULL
-- idx_appointments_campaign partial index (campaign_id IS NOT NULL)
-- idx_appointments_campaign_recipient partial index (campaign_recipient_id IS NOT NULL)
-- Public booking ?c=<recipient_id> query param'ı ile kampanya → randevu attribution'ı
```

35. **Mesaj → randevu attribution** (`067_messages_appointment_link.sql`): ✅ Uygulandı (2026-04-24)
```sql
-- messages.related_appointment_id UUID FK → appointments(id) ON DELETE SET NULL
-- messages.attributed_via text CHECK ('direct','window','manual')
-- idx_messages_related_appt partial index (related_appointment_id IS NOT NULL)
-- idx_messages_template_attribution partial index (business_id, template_name) WHERE template_name IS NOT NULL AND related_appointment_id IS NOT NULL
-- Workflow/cron mesajlarının randevuya dönüşümünü ölçer (İş Zekası ROI endpoint'leri)
```

36. **Waitlist doldurma takibi** (`068_waitlist_filled_appointment.sql`): ✅ Uygulandı (2026-04-24)
```sql
-- waitlist_entries.filled_appointment_id UUID FK → appointments(id) ON DELETE SET NULL
-- waitlist_entries.filled_at timestamptz
-- idx_waitlist_filled partial index (business_id, filled_at) WHERE filled_appointment_id IS NOT NULL
-- Bekleme listesinden hangi randevuların doldurulduğunu izler
```

37. **Kampanya kısa kod** (`069_campaign_recipient_short_code.sql`): ✅ Uygulandı (2026-04-24)
```sql
-- campaign_recipients.short_code TEXT UNIQUE (8 karakter, /r/<code> redirect URL)
-- idx_campaign_recipients_short_code partial index (short_code IS NOT NULL)
-- Kampanya linklerinde UUID (~72 char) yerine /r/<code> (~8 char) — SMS karakter tasarrufu
-- app/r/[code]/page.tsx kısa kodu çözerek /book/<businessId>?c=<recipientId> yönlendirmesi yapar
```

38. **İki katmanlı yorum talebi** (`077_dual_review_requests.sql`): ⏳ Beklemede (2026-04-27)
```sql
-- services.experience_review_delay_days INTEGER DEFAULT 1 — deneyim yorumu kaç gün sonra
-- services.result_review_delay_days INTEGER NULL — sonuçların görülmesi için süre (NULL = sonuç yorumu atla)
-- appointments.result_review_requested BOOLEAN DEFAULT FALSE — ikinci dalga işareti
-- idx_appointments_result_review_pending partial index (status='completed' AND result_review_requested=false)
-- Tipik gecikmeli sonuç hizmetleri için akıllı default'lar (burun estetiği 28g, implant 30g, saç ekimi 90g, botoks/dolgu 14g, vb.)
-- Cron /api/cron/review-requests artık iki geçişli: önce deneyim, sonra sonuç yorumu
```

## Faz 2: Estetik Klinik Özellik Seti (2026-04-04)

### Yeni Tablolar
- `treatment_protocols` — Tedavi protokolü (seans planlı tedavi takibi)
- `protocol_sessions` — Protokol seansları (her seans ayrı satır, planned/completed)
- `customer_photos` — Öncesi/sonrası fotoğraf galerisi
- `customer_allergies` — Müşteri alerji kayıtları
- `service_contraindications` — Hizmet-alerjen uyumsuzluk tanımları
- `referrals` — Müşteri tavsiye/referans sistemi
- `follow_up_queue` — Seans sonrası takip kuyruğu (cron ile işlenir)

### Yeni API Route'ları
- `/api/protocols/*` — Tedavi protokolü CRUD + seans güncelleme
- `/api/photos/*` — Fotoğraf CRUD (Supabase Storage)
- `/api/allergies` — Alerji CRUD
- `/api/contraindications` — Kontrendikasyon CRUD + çapraz kontrol (PUT)
- `/api/referrals` — Referans CRUD + dönüştürme + ödül
- `/api/follow-ups` — Takip kuyruğu yönetimi
- `/api/analytics/revenue` — Gelişmiş gelir analizi (hizmet/personel/dönem/müşteri tipi)
- `/api/analytics/clv` — Müşteri Yaşam Boyu Değeri hesaplama
- `/api/analytics/occupancy` — Doluluk oranı ve verimlilik
- `/api/analytics/staff-performance` — Personel performans karnesi
- `/api/ai/treatment-suggestion` — AI tedavi önerisi (Claude API)
- `/api/public/appointments/[token]` — Token ile randevu görüntüleme/düzenleme/iptal

### Yeni Dashboard Sayfaları
- `/dashboard/protocols` — Tedavi protokolleri listesi + detay paneli + seans timeline
- `/dashboard/referrals` — Referans listesi + istatistikler + ödül takibi

### Yeni Public Sayfalar
- `/book/manage/[token]` — Müşterinin randevusunu düzenlemesi/iptal etmesi

### Sidebar Değişiklikleri
- `medical_aesthetic` sektörüne `protocols` (Tedavi Protokolleri) ve `referrals` (Referanslar) modülleri eklendi
- `StaffPermissions`'a `protocols` ve `referrals` izinleri eklendi

## Sayfa Yapısı
- `/dashboard` → Genel Bakış (server component, bugünkü durum + PerformanceStats)
- `/dashboard/appointments` → Randevular (liste/kutu/haftalık takvim görünüm, soft delete, tekrarlayan randevu desteği)
- `/dashboard/analytics` → Gelir-Gider Tablosu (randevu + fatura + manuel gelir, gider takibi, kâr-zarar)
- `/dashboard/customers` → Müşteriler (slide-over panelde Bilgiler + Geçmiş tabları, timeline)
- `/dashboard/protocols` → Tedavi Protokolleri (seans takibi, ilerleme çubuğu)
- `/dashboard/referrals` → Referanslar (tavsiye sistemi, dönüşüm takibi)
- `/dashboard/settings/audit` → Denetim Kaydı (sadece owner)
- `/invite/[token]` → Personel davet kabul sayfası (public)
- `/book/manage/[token]` → Randevu düzenleme/iptal (public, token bazlı)

## Sidebar Yapısı
- `lib/config/sector-modules.ts` → tüm sektörlerin sidebar config'i
- `components/dashboard/sidebar.tsx` → ICON_MAP, PERMISSION_MAP, bottomNav
- Yeni icon eklenince hem sidebar.tsx ICON_MAP'e hem import'a ekle

## Faz 2 API Önemli Notlar

### Kontrendikasyon Çapraz Kontrol
`PUT /api/contraindications` — auth gerektiren, body: `{ businessId, customerId, serviceId }`
Response: `{ warnings: [...], hasRisk: boolean }`
Randevu oluştururken müşteri + hizmet seçilince bu endpoint çağrılmalı.

### Public Randevu Yönetimi (manage_token)
`GET/PATCH/DELETE /api/public/appointments/[token]` — auth GEREKTİRMEZ (public endpoint)
Token 30 gün geçerli. PATCH ile tarih/saat değiştirilince status → 'pending' olur.
Token URL formatı: `{APP_URL}/book/manage/{manage_token}`
Randevu onaylandığında bu link müşteriye gösterilmeli.

### Analytics Endpoint'leri
Tüm analytics endpoint'leri `?businessId=&from=&to=` parametresi alır:
- `/api/analytics/revenue?groupBy=service|staff|period|customer_type`
- `/api/analytics/clv?customerId=` (tekil) veya `?limit=20` (top liste)
- `/api/analytics/occupancy?staffId=` (opsiyonel filtre)
- `/api/analytics/staff-performance?staffId=` (opsiyonel filtre)

### Fotoğraf Yükleme Akışı
1. Client → Supabase Storage'a direkt upload (bucket: `customer-photos`)
2. Dönen URL → `POST /api/photos` ile DB'ye kaydet
3. Silme: `DELETE /api/photos/[id]?businessId=` hem DB'yi hem Storage'ı temizler

## Yeni Özellik Eklerken
1. Önce `types/index.ts`'e tip ekle
2. Supabase SQL migration yaz
3. RLS policy ekle
4. API route: `app/api/[feature]/route.ts`
5. Page: `app/dashboard/[feature]/page.tsx`
6. Sidebar'a ekle: `lib/config/sector-modules.ts`
7. Permission'a ekle: `types/index.ts` StaffPermissions + sidebar.tsx PERMISSION_MAP
8. Build → commit → push

## Sektör Bazlı Müşteri Etiketleri
| Sektör | Etiket |
|--------|--------|
| psychologist | Danışanlar |
| dental_clinic, medical_aesthetic, physiotherapy, veterinary | Hastalar |
| lawyer | Müvekkiller |
| fitness, yoga_pilates | Üyeler |
| tutoring | Öğrenciler |
| Diğer tüm sektörler | Müşteriler |

## Gerçek Zamanlı Bildirim (Toast)
- **Bileşen:** `components/ui/toast.tsx` — sağ alt köşe toast stack
- **Tetikleme:** `window.dispatchEvent(new CustomEvent('pulse-toast', { detail: { type, title, body } }))`
- **Container:** `app/dashboard/layout.tsx` içinde `<ToastContainer />` render
- **Animasyon:** `globals.css` → `@keyframes toast-slide-in`, `.toast-enter` class
- 5 saniye otomatik kapanma, max 3 toast, bildirim tipine göre renk/ikon
- **Desteklenen type'lar:** `appointment | review | payment | customer | system | stock_alert | error`
- **error tipi:** Kırmızı arka plan, X ikonu — `alert()` yerine hata bildirimi için kullan

## Tekrarlayan Randevular
- `appointments` tablosunda `recurrence_group_id` (uuid) ve `recurrence_pattern` (jsonb) alanları
- Tüm tekrar randevular tek seferde oluşturulur (cron yok)
- Modal'da: haftalık/2 haftalık/aylık sıklık, 2-12 seans
- Çakışma kontrolü her tarih için yapılır, çakışanlar atlanır
- Detay panelde "Tüm Seriyi İptal Et" butonu (gelecekteki seansları iptal eder)

## Müşteri Zaman Çizelgesi (Timeline)
- `customers/page.tsx` slide-over panelde "Bilgiler" ve "Geçmiş" tabları
- Geçmiş: appointments + messages + reviews birleştirilip kronolojik sıra
- Lazy loading: sadece tab açıldığında fetch

## Haftalık & Aylık Takvim Görünümü
- `appointments/page.tsx` → `viewMode === 'week'` veya `viewMode === 'month'`
- `useViewMode` hook: `'list' | 'box' | 'week' | 'month'` destekler
- CSS Grid: 08:00-21:00 saat dilimleri × 7 gün (Pazartesi-Pazar)
- Personel renk kodu ile randevu blokları
- Bugün sütunu vurgulanır + kırmızı saat çizgisi (topPad=12px ile 08:00 satırından boşluk)
- **Çakışma tespiti:** `computeOverlapLayout()` fonksiyonu → aynı saatte birden fazla randevu varsa yan yana kolon olarak gösterilir (greedy column assignment algoritması)
- **Saat dilimi popup:** Randevusu olan saate tıklanınca floating popup açılır → o saatteki tüm randevuları listeler; `slotPopup` state ile yönetilir
- **Aylık görünüm:** 6×7 grid, `getMonthGridDays()` ile hesaplanır; gün tıklanınca liste view'a geçer; 3'ten fazla randevu varsa "+N daha" gösterilir
- **Drag-Drop:** Hem haftalık hem aylık view'da HTML5 native drag-drop ile randevu taşıma; `PATCH /api/appointments/[id]` endpoint çağrılır; çakışma varsa `pulse-toast` error toast gösterilir
- **PATCH /api/appointments/[id]:** `appointment_date`, `start_time`, `end_time` günceller; personel çakışması kontrol edilir (409 → toast)

## Box Görünüm Kartları — Standart Bileşen
- **Paylaşımlı bileşen:** `components/ui/compact-box-card.tsx` → `CompactBoxCard`
- Props: `initials`, `title`, `colorClass`, `badge`, `meta`, `selected`, `onClick`, `children`
- **Tüm sayfalar birebir aynı:** sadece initials (yuvarlak) + isim. Badge/meta kullanılmaz (kompakt görünüm).
- Stoklar sayfasında children (+/- butonları) hariç — stok yönetimi için işlevsel
- Grid: `grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 gap-2` (tüm sayfalar aynı)
- Uygulanan sayfalar: customers, records, reservations, memberships, stoklar, staff, paketler (müşteri paketleri sekmesi)

## Records Dosya Yükleme
- **Storage bucket:** `records-files` (Supabase Storage, public) — ilk yüklemede otomatik oluşturulur
- **Upload API:** `POST /api/records/upload` — `multipart/form-data` (file, businessId, recordId)
- **Admin client:** `createAdminClient()` ile bucket oluşturma + dosya yükleme (RLS bypass)
- **Yol yapısı:** `{businessId}/{recordId}/{timestamp}_{uniqueId}.{ext}`
- **Desteklenen:** PDF, JPG, PNG, HEIC, DOC, DOCX, XLS, XLSX, DICOM (.dcm), TIFF, BMP, WebP, GIF, SVG (maks 50MB)
- **API PATCH:** `file_urls` gönderildiğinde mevcut dosyalara merge edilir (veri bozulmaz)
- **Detay paneli:** Yüklenen resimler thumbnail, dokümanlar ikon+isim olarak gösterilir
- **data tipi:** `Record<string, any>` — `file_urls` string array olarak data içinde saklanır
- **Güncelleme koruması:** `openEditModal`'da `file_urls` formData'ya kopyalanmaz, `handleSave`'de `editingRecord.data.file_urls` her zaman dataPayload'a eklenir — kullanıcı yeni dosya yüklemese bile eski dosyalar korunur

## Mesajlar Sayfası Layout
- **Fixed positioning:** `fixed inset-0 lg:left-64 top-14 z-30` — parent max-w-7xl kısıtlamasını bypass eder
- `lg:left-64` = ana sidebar genişliği (256px)
- `top-14` = TopBar yüksekliği (56px)
- Dark mode: sidebar, chat header, mesaj balonları, input area, tarih ayırıcıları
- **Personel takibi:** Gönderilen mesajlarda `staff_name` gösterilir (outbound balonda küçük yazı)
- **SQL migration gerekli:** `ALTER TABLE messages ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES staff_members(id); ALTER TABLE messages ADD COLUMN IF NOT EXISTS staff_name TEXT;`

## Kayıt Detay Modalı
- Records sayfasında kayıt detayı **merkezi modal** olarak açılır (slide-over değil)
- `max-w-2xl max-h-[90vh]`, rounded-2xl, ESC tuşu ile kapanır
- Üst: ikon + başlık + tarih, orta: dinamik alanlar, alt: dosyalar (grid-cols-4), footer: Düzenle/Sil

## Mesai Tanımları (Shift Definitions)
- `businesses.settings` JSONB'de `shift_definitions` anahtarı: `ShiftDefinition[]`
- `ShiftDefinition`: `{ name: string; start: string; end: string }` (ör: Sabahçı 08:00-14:00, Öğlenci 14:00-20:00)
- Vardiye sayfası "Otomatik Dağıt" panelinde tanım oluşturma/kaydetme
- Otomatik dağıtım: Round-robin — personellere mesai tanımları sırayla atanır; 6 saatten kısa mesailer otomatik "Yarı zamanlı" etiketi alır
- Tekil vardiya modalında "Hızlı Seçim" butonlarıyla tanımlı mesailer seçilebilir
- **Tabloyu Sıfırla:** Haftalık tüm vardiyaları toplu silme (onay dialog'lu)
- **Resim Kaydet:** html2canvas ile tabloyu PNG olarak indirme
- **WhatsApp Paylaş:** Tablo görselini indirip WhatsApp Web linki açma
- `types/index.ts` → `ShiftDefinition` interface, `BusinessSettings.shift_definitions`

## Gelir-Gider Sistemi
- Analytics geliri: `appointmentRevenue + invoiceOnlyRevenue + manualIncome` (çift sayma önlenir)
- `appointment_id`'si olan faturalar, zaten tamamlanan randevulardan sayılıyorsa tekrar sayılmaz
- "Gelir-Gider" tabında hem gelir hem gider ekleme/silme
- **Manuel Gelir:** `/api/income` endpoint, `income` tablosu — Hizmet Geliri, Ürün Satışı, Komisyon, Kira Geliri, Paket/Üyelik, Diğer kategorileri
- **Özel Tekrar Periyodu:** Haftalık, 2 Haftada Bir, Aylık, 3 Ayda Bir, Yıllık + Özel (her X günde bir) — hem gelir hem gider için
- `custom_interval_days` INTEGER sütunu `expenses` ve `income` tablolarında
- **Gelir Trendi:** Grafik hem randevu + fatura + manuel geliri gösterir; 7 gün/30 gün/1 yıl
- **Fatura → Stok otomatik düşürme:** Fatura ödendiğinde (`status: 'paid'`), `product_id` olan kalemler stoktan düşer + `stock_movements` kaydı oluşur
- `InvoiceItem` type'ında `product_id?: string` ve `type?: 'service' | 'product'` alanları mevcut

## Fatura Ödeme Sistemi
- **Ödeme tipleri:** Standart (tek seferde), Taksitli (2-12 taksit, haftalık/2 haftalık/aylık), Kaporalı (ön ödeme + kalan)
- **Ödeme geçmişi:** `invoice_payments` tablosu — her ödeme kaydı (tutar, yöntem, tip, taksit no, personel, not)
- **paid_amount:** Fatura üzerinde toplam ödenen tutar; ödeme kaydedildikçe otomatik güncellenir
- **Otomatik status:** paid_amount >= total → 'paid', > 0 → 'partial', 0 → 'pending'
- **İlerleme çubuğu:** Detay panelde ödeme progress bar'ı
- **API endpoint:** `/api/invoices/payments` — GET (geçmiş), POST (yeni ödeme kaydet + status güncelle)
- **POS backlink:** Kasadan oluşturulan faturalarda `pos_transaction_id` ayarlanır → "Kasadan Oluşturuldu" badge
- **Gelişmiş filtreler:** Müşteri, ödeme yöntemi, tarih aralığı, tutar aralığı, sıralama (server-side)
- **Export:** CSV + PDF (jspdf + jspdf-autotable) + Excel (xlsx)
- **Tipler:** `InvoicePayment`, `InvoicePaymentType`, `InstallmentFrequency`, `PaymentRecordType` — `types/index.ts`

## Aktif Geliştirme Odağı
- **Öncelikli Sektörler:** Estetik Klinik (`medical_aesthetic`) ve Diş Kliniği (`dental_clinic`)
- Tüm yeni özellikler öncelikle bu iki sektör için geliştirilecek
- Diğer sektörler mevcut haliyle desteklenmeye devam eder

## Sektör Odak Stratejisi
Odak: Estetik Klinik (medical_aesthetic) & Diş Kliniği (dental_clinic) — tedavi protokolleri, reçete yönetimi, laboratuvar takibi, post-care talimatları, diş haritası, hasta dosyaları.
İkincil: Kuaför, Berber, Güzellik Salonu, Psikolog, Veteriner, Fizyoterapi, Diyetisyen, Fitness, Yoga/Pilates, Spa/Masaj.

## Personel Detay Popup
- Personel detayı slide-over yerine ortada popup (centered modal) olarak açılır
- Yetkiler `localPerms` state'inde toplanır, tek seferde "Kaydet" butonuyla güncellenir
- `handleBatchSavePermissions()` → tüm yetkileri tek API çağrısı ile kaydeder + audit log

## Bilinen Timezone Düzeltmeleri
- **Vardiya sayfası:** `formatDate()` → `toISOString()` yerine yerel tarih getter'ları kullanılır (UTC kayma sorunu)
- **Randevu sayfası:** Tarih oluşturmada `new Date(year, month - 1, day)` pattern kullanılır

## Ücretlendirme (ne zaman ücretli plana geç)
- **Vercel Pro ($20/ay):** İlk ticari müşteride → free plan ticari kullanıma kapalı
- **Supabase Pro ($25/ay):** 50K MAU aşıldığında veya birden fazla aktif müşteri olduğunda
- **Toplam ~$45/ay** ilk aşamada
