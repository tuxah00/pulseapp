# PulseApp — Claude Code Proje Rehberi

## Proje Özeti
PulseApp, çok sektörlü SaaS işletme yönetim platformu. Next.js 14, Supabase, Tailwind CSS, TypeScript.

## Deploy
- **GitHub repo:** tuxah00/pulseapp
- **Vercel:** main branch'e her push'ta otomatik deploy
- **Kural:** Her değişiklik sonrası build kontrol et → commit → push (kullanıcıya sormadan)

## Teknik Stack
- **Frontend:** Next.js 14 (App Router), React, Tailwind CSS, TypeScript
- **Backend:** Supabase (PostgreSQL + RLS + Realtime)
- **Auth:** Supabase Auth → staff_members tablosu ile işletmeye bağlı
- **AI:** Anthropic Claude API (`claude-sonnet-4-20250514`) via `@anthropic-ai/sdk`
- **Model:** `lib/ai/client.ts` → `getAnthropicClient()`, `AI_MODEL`, `MAX_TOKENS`

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
- Loglanan eylemler: create/update/delete/status_change
- Loglanan kaynaklar: appointment, customer, staff, permissions, service, settings

## Güvenlik
- Randevular SOFT DELETE kullanır: `deleted_at` sütunu — hard delete yok
- Tüm appointment sorguları `.is('deleted_at', null)` filtresi içermeli
- RLS tüm tablolarda aktif (business_id bazlı izolasyon)
- `staff_invitations` tablosu ile davet linki sistemi (7 gün geçerli)

## Önemli Tablolar
| Tablo | Açıklama |
|-------|---------|
| `businesses` | İşletme kayıtları |
| `staff_members` | Personel + yetki (user_id → auth.uid()) |
| `appointments` | Randevular (deleted_at ile soft delete) |
| `customers` | Müşteriler (segment: new/regular/vip/risk/lost) |
| `services` | Hizmetler |
| `notifications` | Bildirimler (is_read, type) |
| `audit_logs` | Denetim kaydı (sadece owner görür) |
| `staff_invitations` | Davet linkleri (token, expires_at) |
| `business_records` | Dosya kayıtları (diş/psikolog/klinik vb.) |
| `orders` | Siparişler (restoran/kafe sektörü) |
| `table_reservations` | Masa rezervasyonları |

## SQL Migration Gereksinimleri
Supabase'de çalıştırılmış olması gereken SQL'ler:
1. `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS deleted_at timestamptz;`
2. `CREATE TABLE IF NOT EXISTS audit_logs (...)`
3. `CREATE TABLE IF NOT EXISTS staff_invitations (...)`
4. `ALTER TABLE business_records ADD COLUMN IF NOT EXISTS file_urls jsonb DEFAULT '[]';`
5. `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_group_id uuid;`
6. `ALTER TABLE appointments ADD COLUMN IF NOT EXISTS recurrence_pattern jsonb;`
7. **Sektör enum genişletme** (yoga_pilates, spa_massage vb. için):
```sql
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'spa_massage';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'yoga_pilates';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'tattoo_piercing';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'fitness';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'medical_aesthetic';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'car_wash';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'photo_studio';
ALTER TYPE sector_type ADD VALUE IF NOT EXISTS 'dietitian';
```

## Sayfa Yapısı
- `/dashboard` → Genel Bakış (server component, bugünkü durum + PerformanceStats)
- `/dashboard/appointments` → Randevular (liste/kutu/haftalık takvim görünüm, soft delete, tekrarlayan randevu desteği)
- `/dashboard/analytics` → Gelir-Gider Tablosu (sadece gelir odaklı)
- `/dashboard/customers` → Müşteriler (slide-over panelde Bilgiler + Geçmiş tabları, timeline)
- `/dashboard/settings/audit` → Denetim Kaydı (sadece owner)
- `/invite/[token]` → Personel davet kabul sayfası (public)

## Sidebar Yapısı
- `lib/config/sector-modules.ts` → tüm sektörlerin sidebar config'i
- `components/dashboard/sidebar.tsx` → ICON_MAP, PERMISSION_MAP, bottomNav
- Yeni icon eklenince hem sidebar.tsx ICON_MAP'e hem import'a ekle

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
- **Tetikleme:** `top-bar.tsx` Supabase Realtime INSERT event → `window.dispatchEvent(new CustomEvent('pulse-toast', { detail }))`
- **Container:** `app/dashboard/layout.tsx` içinde `<ToastContainer />` render
- **Animasyon:** `globals.css` → `@keyframes toast-slide-in`, `.toast-enter` class
- 5 saniye otomatik kapanma, max 3 toast, bildirim tipine göre renk/ikon

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

## Haftalık Takvim Görünümü
- `appointments/page.tsx` → `viewMode === 'week'`
- `useViewMode` hook: `'list' | 'box' | 'week'` destekler
- CSS Grid: 08:00-21:00 saat dilimleri × 7 gün (Pazartesi-Pazar)
- Personel renk kodu ile randevu blokları
- Bugün sütunu vurgulanır + kırmızı saat çizgisi

## Box Görünüm Kartları — Standart Bileşen
- **Paylaşımlı bileşen:** `components/ui/compact-box-card.tsx` → `CompactBoxCard`
- Props: `initials`, `title`, `colorClass`, `badge`, `meta`, `selected`, `onClick`, `children`
- Yeni box görünüm sayfalarında hep bu bileşen kullanılmalı
- Uygulanan sayfalar: customers, records, reservations, memberships, stoklar, **staff** (CompactBoxCard)
- **Records sayfası:** `grid-cols-3 sm:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8` — 7-8 kart/satır
- **Staff sayfası:** `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` — 4-5 kart/satır

## Records Dosya Yükleme
- **Storage bucket:** `records-files` (Supabase Storage, public) — ilk yüklemede otomatik oluşturulur
- **Upload API:** `POST /api/records/upload` — `multipart/form-data` (file, businessId, recordId)
- **Admin client:** `createAdminClient()` ile bucket oluşturma + dosya yükleme (RLS bypass)
- **Yol yapısı:** `{businessId}/{recordId}/{timestamp}_{uniqueId}.{ext}`
- **Desteklenen:** PDF, JPG, PNG, HEIC, DOC, DOCX, XLS, XLSX (maks 50MB)
- **API PATCH:** `file_urls` gönderildiğinde mevcut dosyalara merge edilir (veri bozulmaz)
- **Detay paneli:** Yüklenen resimler thumbnail, dokümanlar ikon+isim olarak gösterilir
- **data tipi:** `Record<string, any>` — `file_urls` string array olarak data içinde saklanır
- **Güncelleme koruması:** `openEditModal`'da `file_urls` formData'ya kopyalanmaz, `handleSave`'de `editingRecord.data.file_urls` her zaman dataPayload'a eklenir — kullanıcı yeni dosya yüklemese bile eski dosyalar korunur

## Mesajlar Sayfası Layout
- **Fixed positioning:** `fixed inset-0 lg:left-64 top-14 z-30` — parent max-w-7xl kısıtlamasını bypass eder
- `lg:left-64` = ana sidebar genişliği (256px)
- `top-14` = TopBar yüksekliği (56px)
- Dark mode: sidebar, chat header, mesaj balonları, input area, tarih ayırıcıları

## Bilinen Timezone Düzeltmeleri
- **Vardiya sayfası:** `formatDate()` → `toISOString()` yerine yerel tarih getter'ları kullanılır (UTC kayma sorunu)
- **Randevu sayfası:** Tarih oluşturmada `new Date(year, month - 1, day)` pattern kullanılır

## Ücretlendirme (ne zaman ücretli plana geç)
- **Vercel Pro ($20/ay):** İlk ticari müşteride → free plan ticari kullanıma kapalı
- **Supabase Pro ($25/ay):** 50K MAU aşıldığında veya birden fazla aktif müşteri olduğunda
- **Toplam ~$45/ay** ilk aşamada
