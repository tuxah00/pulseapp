# PulseApp — Claude Code Proje Rehberi

## Proje Özeti
PulseApp, çok sektörlü SaaS işletme yönetim platformu. Next.js 14, Supabase, Tailwind CSS, TypeScript.

## Deploy
- **GitHub repo:** tuxah00/pulseapp
- **Vercel:** main branch'e her push'ta otomatik deploy
- **Kural:** Her değişiklik sonrası build kontrol et → commit → push (kullanıcıya sormadan)

## Git Commit Formatı
```
<type>: <Türkçe açıklama>

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```
**type değerleri:** `feat` (yeni özellik) | `fix` (hata düzeltme) | `refactor` (yapısal değişiklik) | `chore` (config/bağımlılık) | `docs` (dokümantasyon)

Örnekler:
- `feat: randevu tekrarlama özelliği eklendi`
- `fix: haftalık takvimde 08:00 çizgisi çakışması giderildi`
- `refactor: confirm() çağrıları useConfirm() ile değiştirildi`

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
| `appointments` | Randevular (deleted_at ile soft delete) |
| `customers` | Müşteriler (segment: new/regular/vip/risk/lost) |
| `services` | Hizmetler |
| `notifications` | Bildirimler (is_read, type) |
| `audit_logs` | Denetim kaydı (sadece owner görür) |
| `staff_invitations` | Davet linkleri (token, expires_at) |
| `business_records` | Dosya kayıtları (diş/psikolog/klinik vb.) |
| `orders` | Siparişler (restoran/kafe sektörü) |
| `table_reservations` | Masa rezervasyonları |

## Dark Mode Stratejisi
- `globals.css`'te `.dark .bg-white`, `.dark .text-gray-900`, `.dark .bg-gray-100` vb. agresif global `!important` override'lar mevcut
- Colored badge'ler için semi-transparent dark variants: `.dark .bg-blue-100 { background-color: rgba(59,130,246,0.15) !important }` vb.
- Custom input alanları (`.input` class kullanmayanlar) explicit `dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600` almalı
- Modal/dialog arka planları: `dark:bg-gray-900`
- **Tema toggle:** `components/dashboard/top-bar.tsx`'te Sun/Moon butonu (notification bell'in solunda)
- Settings sayfasından tema toggle kaldırıldı

## Modal Animasyonları & ESC
- `globals.css` → `.modal-overlay` (fadeIn 0.15s), `.modal-content` (scaleIn 0.2s), `.slide-panel` (slideInRight 0.2s)
- **Kapanma animasyonu:** `.modal-overlay.closing` (fadeOut 0.15s), `.modal-content.closing` (scaleOut 0.15s), `.slide-panel.closing` (slideOutRight 0.2s)
- Modal backdrop div'e `modal-overlay`, içerik kartına `modal-content` class ekle
- Kapanma pattern: `closing` state → `.closing` CSS class ekle → `onAnimationEnd` ile unmount
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
9. **Sektör enum genişletme** (yoga_pilates, spa_massage vb. için):
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

## Sayfa Yapısı
- `/dashboard` → Genel Bakış (server component, bugünkü durum + PerformanceStats)
- `/dashboard/appointments` → Randevular (liste/kutu/haftalık takvim görünüm, soft delete, tekrarlayan randevu desteği)
- `/dashboard/analytics` → Gelir-Gider Tablosu (randevu + fatura + manuel gelir, gider takibi, kâr-zarar)
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
- Bugün sütunu vurgulanır + kırmızı saat çizgisi (topPad=12px ile 08:00 satırından boşluk)
- **Çakışma tespiti:** `computeOverlapLayout()` fonksiyonu → aynı saatte birden fazla randevu varsa yan yana kolon olarak gösterilir (greedy column assignment algoritması)
- **Saat dilimi popup:** Randevusu olan saate tıklanınca floating popup açılır → o saatteki tüm randevuları listeler; `slotPopup` state ile yönetilir

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
