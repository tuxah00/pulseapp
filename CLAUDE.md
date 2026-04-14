# Claude Code Configuration

## Git Permissions
- Can push to: `claude/*` branches
- Can commit: Yes, with descriptive messages
- Can merge: Yes, to feature branches only
- Cannot: Force push, push to main/master without approval

## Destructive Operations
- Cannot: `git reset --hard`, `git clean -f`, `rm -rf`
- Cannot: Delete database, drop tables
- Requires approval: Any breaking changes to API

## Safe Operations (Auto-approved)
- npm install/run
- Running tests
- Reading/editing files in feature branches
- Creating commits with clear messages
- Running linters and builds
Do not include claude.ai session links in commit messages.

---

## İletişim Kuralı — Teknik Terimler

Kullanıcı teknik terimlere yabancıdır. Bu nedenle:
- Her yeni teknik terim ilk kullanımında **parantez içinde Türkçe açıklamasıyla** verilecek.
- Örnek: "main'e merge (birleştirme) ettim", "commit (kayıt) oluşturuldu", "deploy (yayına alma) tamamlandı"
- Aşağıdaki terimler için standart açıklamalar kullanılacak:

| Terim | Açıklama |
|-------|----------|
| commit | Kod değişikliklerini kaydetme |
| push | Değişiklikleri GitHub'a gönderme |
| pull | GitHub'daki güncel kodu indirme |
| branch | Paralel çalışma kolu |
| merge | İki branch'i birleştirme |
| main | Canlıdaki ana kod kolu |
| PR / Pull Request | Branch'i main'e eklemek için açılan inceleme isteği |
| deploy | Kodun sunucuya yüklenerek kullanıcılara açılması |
| worktree | Ayrı izole çalışma klasörü |
| revert | Değişikliği geri alma |
| migration | Veritabanı yapı değişikliği (tablo/kolon ekleme) |
| build | Kodun production'a hazır hale getirilmesi |

---

## Proje: PulseApp

İşletmelere yönelik randevu, müşteri ve mesajlaşma yönetim platformu. Çok sektörlü (kuaför, klinik, oto servis vb.) çalışacak şekilde tasarlanmış.

---

## Teknoloji Yığını

- **Framework**: Next.js 14 (App Router)
- **Dil**: TypeScript 5.5
- **Veritabanı / Auth**: Supabase (PostgreSQL + RLS + SSR)
- **Stil**: Tailwind CSS 3.4 + özel `pulse-*` renk paleti
- **Yapay Zeka**: Anthropic Claude SDK (`@anthropic-ai/sdk ^0.78`)
- **SMS**: Twilio (`twilio ^5.12`)
- **Ödeme**: PayTR (webhook tabanlı, henüz tamamlanmadı)
- **E-posta**: Resend (yapılandırıldı, entegrasyon kısmi)
- **Tarih**: date-fns + date-fns-tz
- **İkonlar**: Lucide React

---

## Proje Kök Dizini

```
pulseapp-v2-fixed/
└── pulseapp/          ← Tüm uygulama kodu buradadır
    ├── app/           ← Next.js App Router sayfaları ve API route'ları
    ├── components/    ← UI bileşenleri
    ├── lib/           ← Yardımcı fonksiyonlar, Supabase istemcileri, hooks
    ├── types/         ← TypeScript tip tanımları (index.ts)
    └── supabase/      ← Migration dosyaları
```

> `next dev` ve `next build` komutları `pulseapp/` içinden çalıştırılmalıdır.

---

## Test Hesabı

Geliştirme ve doğrulama sırasında kullanılabilecek test hesabı:
- **E-posta:** `pulseapp@gmail.com`
- **Şifre:** `123123`

---

## Mimari Kararlar

### Auth Akışı
- `@supabase/ssr` kullanılıyor (cookie tabanlı, SSR uyumlu)
- `lib/supabase/client.ts` → browser, `lib/supabase/server.ts` → server components, `lib/supabase/admin.ts` → service role (yalnızca API route'larında kullanılmalı)
- Dashboard layout (`app/dashboard/layout.tsx`) auth guard içeriyor; oturum yoksa `/auth/login`'e yönlendiriyor
- İlk girişte `staff_members` kaydı yoksa `OnboardingForm` gösteriliyor

### Dashboard Bağlamı
- `BusinessProvider` (Context API) tüm dashboard route'larını sarıyor
- `businessId`, `userId`, `staffId`, `sector`, `plan` değerleri context'ten okunuyor
- Sidebar ve özellikler `sector-modules.ts` üzerinden dinamik olarak yükleniyor

### API Route Yapısı
- `/api/ai/*` → Claude ile sınıflandırma, yanıt önerisi, haftalık analiz
- `/api/cron/*` → Hatırlatma SMS'leri, winback kampanyaları, yorum istekleri (CRON_SECRET korumalı)
- `/api/public/business/[id]/*` → Müşteri randevu sayfası için public endpoint'ler
- `/api/webhooks/sms` ve `/api/webhooks/twilio` → Twilio gelen mesaj webhook'ları
- `/api/webhooks/paytr` → PayTR ödeme bildirimleri

### Supabase Admin İstemcisi
- `lib/supabase/admin.ts` RLS'yi bypass eder — **yalnızca** server-side API route'larında import edilebilir
- Hiçbir zaman client component veya `use client` dosyasında import edilmemeli

---

## Veritabanı Şeması (Migration Sırası)

1. Temel tablolar (businesses, staff_members, customers, appointments, messages, reviews)
2. `003_fix_appointment_customer_segment.sql`
3. `004_create_products_table.sql`
4. `005_fix_security_definer_views.sql`
5. `006_create_shifts.sql` → Personel vardiya yönetimi
6. `007_create_waitlist.sql` → Bekleme listesi

---

## Tip Tanımları

Tüm tipler `pulseapp/types/index.ts` içinde merkezi olarak yönetiliyor.

Kritik enum'lar:
- `SectorType` — 21 sektör (hair_salon, barber, dental_clinic…)
- `PlanType` — starter | standard | pro
- `AppointmentStatus` — pending | confirmed | completed | cancelled | no_show
- `CustomerSegment` — new | regular | vip | risk | lost
- `AiClassification` — appointment | question | complaint | cancellation | greeting | other

Fiyatlar: starter=499₺, standard=999₺, pro=1999₺

---

## Ortam Değişkenleri (Zorunlu)

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_PHONE_NUMBER
ANTHROPIC_API_KEY
NEXT_PUBLIC_APP_URL        # Randevu linkleri için kritik
CRON_SECRET                # /api/cron/* route'larını korur
```

Opsiyonel: `PAYTR_*`, `RESEND_API_KEY`, `GOOGLE_PLACES_API_KEY`

---

## Bekleyen Harici Entegrasyonlar (Altyapı Hazır, Hesap Bağlanacak)

Aşağıdaki özelliklerin kodu tamamlandı; aktif etmek için sadece ilgili hesap açılıp env değişkeni eklenecek:

| Özellik | Eksik Env Değişkeni | Hazır Dosyalar | Not |
|---------|---------------------|----------------|-----|
| **WhatsApp Business** | `TWILIO_WHATSAPP_NUMBER` | `lib/whatsapp/send.ts`, `lib/whatsapp/templates.ts`, `app/api/webhooks/whatsapp/route.ts` | Twilio konsolunda WA Sandbox'ı etkinleştir, sandbox için `whatsapp:+14155238886` |
| **PayTR Ödeme** | `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` | `lib/billing/paytr.ts`, `app/api/billing/checkout/route.ts`, `app/api/webhooks/paytr/route.ts`, `app/dashboard/settings/billing/page.tsx` | paytr.com'dan merchant hesabı aç |
| **Paraşüt E-Fatura** | `PARASUT_CLIENT_ID`, `PARASUT_CLIENT_SECRET`, `PARASUT_USERNAME`, `PARASUT_PASSWORD` | `lib/efatura/parasut.ts`, `app/api/efatura/route.ts` | parasut.com API erişimi için başvur |
| **Vercel Cron Jobs** | — (env yok, `vercel.json` güncellenmeli) | `app/api/cron/reminders/route.ts`, `app/api/cron/birthday/route.ts`, `app/api/cron/review-requests/route.ts`, `app/api/cron/winback/route.ts`, `app/api/cron/ai-scheduled-runner/route.ts`, `app/api/cron/campaigns/route.ts` | `vercel.json`'a cron schedule ekle, `CRON_SECRET` zaten tanımlı olmalı. **Vercel Pro planı gerekir** (Hobby planında cron job limiti 2/gün) — abonelik açılana kadar `vercel.json`'daki `crons` girişleri ertelenmiş durumdadır, ilgili özellikler (AI günlük brief, zamanlanmış eylemler, kampanya otomasyonu, hatırlatma SMS'leri, winback) cron tetiklenmeden çalışmaz. |

---

## Ertelenen Abonelik Gerektiren Deploylar

Aşağıdaki özellikler **kod tarafında tamamlanmış** ama production'da çalışması için ücretli abonelik gerektiriyor. Şimdilik atlanmış, abonelik açıldığında aktifleştirilecek:

| Özellik | Gerekli Abonelik | Durum |
|---------|------------------|-------|
| AI zamanlanmış eylemler cron (`/api/cron/ai-scheduled-runner`) | Vercel Pro ($20/ay) | Kod hazır, `vercel.json`'a cron satırı eklenmedi |
| Kampanya gönderim cron (`/api/cron/campaigns`) | Vercel Pro | Kod hazır, cron tetiklenmiyor |
| Günlük AI brief cron (`/api/cron/ai-daily-brief`) | Vercel Pro | Faz 4'te eklenecek |
| Hatırlatma / winback / doğum günü / yorum SMS cron'ları | Vercel Pro | Kod hazır, cron tetiklenmiyor |
| PayTR ödeme akışı | PayTR merchant hesabı | Env eklenince aktif |
| Paraşüt e-Fatura | Paraşüt API erişimi | Env eklenince aktif |
| Twilio WhatsApp | Twilio WA Business onayı | Env eklenince aktif |
| Resend e-posta | Resend hesabı | Kod kısmi |

**Kural:** Bu listede olan bir özellik için yeni kod yazılabilir ama deploy adımında `vercel.json` cron satırı VEYA env değişkeni gerekiyorsa **es geçilir** ve bu tabloya eklenir.

---

## Aktif Geliştirme Odağı

- **Öncelikli Sektörler:** Estetik Klinik (`medical_aesthetic`) ve Diş Kliniği (`dental_clinic`)
- Tüm yeni özellikler öncelikle bu iki sektör için geliştirilecek

---

## Bilinen Eksikler / Dikkat Edilecekler

- **Form validasyonu zayıf**: `zod` veya `react-hook-form` yok; validasyon sayfadan sayfaya değişiyor
- **Test altyapısı yok**: Jest/Vitest/Cypress kurulu değil
- **Dil karışıklığı**: Kod içinde Türkçe (`vardiye`, `stoklar`) ve İngilizce isimlendirme karışık

---

## Özellik Entegrasyon Stratejisi

### Sonraya Bırakılan (Dış Hesap/Abonelik Gerektiren)
Bu özellikler altyapısı hazır ama dış servis hesabı açılmadan çalışmaz:
- **PayTR Ödeme**: `PAYTR_MERCHANT_ID/KEY/SALT` — ödeme akışı, plan aktivasyonu
- **Paraşüt e-Fatura**: `PARASUT_CLIENT_ID/SECRET/USERNAME/PASSWORD/COMPANY_ID` — e-fatura gönderimi
- **Resend E-posta**: `RESEND_API_KEY` — e-posta bildirimleri (henüz hiç kod yok)
- **Twilio SMS/WhatsApp**: `TWILIO_ACCOUNT_SID/AUTH_TOKEN/PHONE_NUMBER` — mesajlaşma
- **Google Places**: `GOOGLE_PLACES_API_KEY` — işletme yorumları çekme
- **Cron Otomasyonları**: Dış tetikleyici (Vercel Cron, cron-job.org) gerekli

### Eklenecek (Dış Hesap Gerektirmeyen)
Bu özellikler sadece DB + UI çalışması gerektirir, herhangi bir dış servis gerektirmez:
- **KVKK Onay Yönetimi**: Dashboard sayfası + booking sayfasında onay checkbox'u (`consent_records` tablosu mevcut)
- **Müşteri Alerji Yönetimi**: Müşteri detayında alerji kayıt/görüntüleme UI (`customer_allergies` tablosu mevcut)
- **Hizmet Kontrendikasyonları**: Hizmet ayarlarında kontrendikasyon tanımlama UI (`service_contraindications` tablosu mevcut)
- **Takip Kuyruğu**: Randevu sonrası takip planlaması UI (`follow_up_queue` tablosu mevcut)
- **AI Photo Analysis**: Fotoğraf analizi route implementasyonu (ANTHROPIC_API_KEY zaten mevcut)
- **AI Treatment Suggestion**: Tedavi önerisi route implementasyonu (ANTHROPIC_API_KEY zaten mevcut)

---

## Kodlama Kuralları

- Yeni bileşenler `components/ui/` (atomik) veya `components/dashboard/` (panel'e özgü) altına ekle
- Sayfa-özel bileşenler ilgili route dizininde `_components/` altına konulmalı
- Supabase sorguları doğrudan sayfada yazılabilir (Server Component); karmaşıklaşırsa `lib/` altına taşı
- Dark mode: `dark:` prefix'i Tailwind ile, `ThemeProvider` zaten dashboard layout'unda mevcut
- Lucide icon'ları `lucide-react`'tan import et; dinamik ikonlar için `sector-modules.ts` pattern'ini takip et
- Tüm modal/overlay'ler `components/ui/dialog.tsx` Dialog bileşeni kullanmalı. Custom `modal-overlay` div oluşturulmamalı — Portal desteği olmadığından stacking context sorunu oluşur ve overlay tam ekranı kaplamaz
- Tüm dropdown/select elementleri `components/ui/custom-select.tsx` (`CustomSelect`) bileşenini kullanmalı. Native `<select>` kullanılmamalı — tarayıcı stillerine bağımlı olduğundan dark mode ve tema tutarlılığını bozar

---

## Son Önemli Değişiklikler

- `be08ca0`: `app/[id]` route çakışması giderildi, businesses panel kaldırıldı
- `cd5cd72`: `tsconfig` hedefi ES2017'ye çekildi (Set/Map iteration fix)
- `2026-03-19`: Bildirimler paneline "Yeni" badge göstergesi eklendi (son 24 saat)
- `2026-03-19`: Sektör alanı ayarlar sayfasında değiştirilebilir hale getirildi (test modu)
- `2026-03-19`: Vardiye yönetimi hata handling düzeltildi; `008_fix_shifts_trigger.sql` migration eklendi (moddatetime → standart trigger)
- `2026-03-19`: Vardiye otomatik dağıtım paneli yeniden yazıldı — gün seçimi (pill toggle) + mesai saati inputları + özet satırı + hata görünürlüğü; working_hours DB bağımlılığı kaldırıldı

---

## Supabase Migration Durumu

Aşağıdaki migration'lar Supabase SQL Editor'de manuel olarak çalıştırılmalıdır:
- `008_fix_shifts_trigger.sql` — shifts tablosunun updated_at trigger'ını moddatetime'dan bağımsız hale getirir (vardiye kaydetme için kritik)
- `035_rewards.sql` — `rewards` ve `customer_rewards` tabloları, RLS politikaları (ödül sistemi için gerekli)

### Uygulanan Migration'lar (Supabase'de çalıştırıldı)
- `006_create_shifts.sql` + `008_fix_shifts_trigger.sql` → **✅ Uygulandı (2026-03-19)**
- `027_whatsapp_enhancements.sql` → **✅ Uygulandı (2026-04-09)** — `customers.preferred_channel` kolonu, WA index
- `028_kvkk_compliance.sql` → **✅ Uygulandı (2026-04-09)** — `consent_records`, `data_deletion_requests` tabloları, RLS politikaları
