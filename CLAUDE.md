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

## Özet Üslubu (Token Tasarrufu)

- Yapılan değişiklikleri **kısa** özetle — madde madde, teknik detaya girmeden.
- Örn: "Granüler yetki sisteminin zemini atıldı." yeterli; dosya/fonksiyon listesi verilmez.
- Kullanıcı teknik detay istediğinde ayrıntıya gir.

---

## Proje: PulseApp

İşletmelere yönelik randevu, müşteri ve mesajlaşma yönetim platformu. Çok sektörlü (kuaför, klinik, oto servis vb.) çalışacak şekilde tasarlanmış.

---

## Proje Durumu — Tasarım / Geliştirme Aşaması

- **Canlı yayın YOK.** Proje henüz production'a alınmamış.
- **Gerçek veri YOK.** Sadece geliştirme/test hesapları kullanılıyor.
- **Saldırgan riski YOK.** Dış dünyaya açık değil.
- **Sonuç:** Güvenlik bulguları (auth eksiği, rate-limit, PII sızıntısı, Zod validasyonu vb.) **yayın öncesi** kapatılacak. Şu an öncelik: UI, özellik tamamlama, kod borcu temizliği. Güvenlik sert kapama listesi aşağıda "Yayın Öncesi Kilit Kontroller" bölümünde tutuluyor.

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
- `/api/ai/*` → OpenAI GPT-4o Mini ile sınıflandırma, yanıt önerisi, asistan, haftalık analiz
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
| AI zamanlanmış eylemler cron (`/api/cron/ai-scheduled-runner`) | Vercel Pro ($20/ay) | Kod hazır; **taslak cron**: `{ "path": "/api/cron/ai-scheduled-runner", "schedule": "*/5 * * * *" }` — abonelik açılınca `vercel.json`'a eklenecek |
| AI embedding worker (`/api/cron/ai-embed-worker`) — Faz 2 | Vercel Pro | Kod hazır; **taslak cron**: `{ "path": "/api/cron/ai-embed-worker", "schedule": "0 3 * * *" }` — son 6 ayın yeni içeriklerini nightly embed eder (AI mesajlar, müşteri notları, protokol notları) |
| AI memory extractor (`/api/cron/ai-memory-extractor`) — Faz 2 | Vercel Pro | Kod hazır; **taslak cron**: `{ "path": "/api/cron/ai-memory-extractor", "schedule": "30 3 * * *" }` — uzun sohbetleri özetler (`ai_conversations.summary` günceller) |
| Kampanya gönderim cron (`/api/cron/campaigns`) | Vercel Pro | Kod hazır, cron tetiklenmiyor |
| Günlük AI brief cron (`/api/cron/ai-daily-brief`) | Vercel Pro | Kod hazır (Faz 4); **taslak cron**: `{ "path": "/api/cron/ai-daily-brief", "schedule": "0 5 * * *" }` — abonelik açılınca `vercel.json`'a eklenecek |
| Haftalık stratejik plan cron (`/api/cron/ai-weekly-plan`) — Faz 5.1 | Vercel Pro | Kod hazır; **taslak cron**: `{ "path": "/api/cron/ai-weekly-plan", "schedule": "0 7 * * 1" }` — pazartesi 07:00, her işletme için haftalık plan → `ai_insights` |
| Benchmark agregasyon cron (`/api/cron/ai-benchmark-aggregate`) — Faz 5.3 | Vercel Pro | Kod hazır; **taslak cron**: `{ "path": "/api/cron/ai-benchmark-aggregate", "schedule": "30 3 * * 1" }` — opt-in işletmelerden son tamamlanmış çeyreği anonim olarak agregeler (p25/p50/p75, sample ≥ 20) |
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
Bu özellikler sadece DB + UI çalışması gerektirir, herhangi bir dış servis gerektirmez.

Güncel durum (2026-04-18 taraması):
- **KVKK Onay Yönetimi** → Uygulandı: `app/dashboard/settings/consents` + booking onay checkbox'u
- **Müşteri Alerji Yönetimi** → Uygulandı: müşteri paneli alerji tab'ı
- **Hizmet Kontrendikasyonları** → Uygulandı: `settings/services` kontrendikasyon modal'ı
- **Takip Kuyruğu** → Uygulandı: `/dashboard/follow-ups` + randevu sonrası planlama modal'ı
- **AI Photo Analysis** → İptal/Kaldırıldı: route ve panel orphan olarak silindi (2026-04-18)
- **AI Treatment Suggestion** → İptal/Kaldırıldı: route ve dental plugin aksiyonu silindi (2026-04-18)

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
- `2026-04-18`: Migration numara çakışmaları a/b suffix ile çözüldü (036, 037, 040, 049, 050, 053, 054); duplicate `032_kvkk_compliance.sql` silindi
- `2026-04-18`: Orphan AI kodları temizlendi — `/api/ai/treatment-suggestion`, `photo-analysis-panel.tsx`, dental plugin içindeki `treatment-plan-generate` ve `dental-treatment-suggest` girişleri kaldırıldı
- `2026-04-18`: Native `<select>` → `CustomSelect` dönüşümü (register, book, book/manage sayfaları)
- `2026-04-18`: 6 ana dashboard sayfasında (appointments, customers, invoices, reviews, inventory, rewards) tekrarlayan boş-durum JSX'i ortak `EmptyState` bileşenine taşındı
- `2026-04-18`: Dialog/Sheet `sr-only="Close"` etiketi Türkçeleştirildi (`"Kapat"`)
- `2026-04-23`: **AI Asistan Faz 1 — Motor Konsolidasyonu** (`b1ef3c8`). Anthropic Claude tamamen kaldırıldı; 7 AI endpoint OpenAI GPT-4o Mini'ye taşındı (classify, reply, review-response, insights, campaign-suggest, photo-analysis, before-after). `@anthropic-ai/sdk` dependency silindi. Tek motor, maliyet optimizasyonu.
- `2026-04-23`: **AI Asistan Faz 2 — Hafıza ve RAG Altyapısı**. 3 yeni migration (`061`, `062`, `063`), `lib/ai/memory/` modülü (read/write/embed/types), 3 yeni asistan aracı (`semantic_search_history`, `remember_preference`, `forget_preference`), 2 yeni cron (`ai-embed-worker`, `ai-memory-extractor`). Asistan artık sohbetler arası kalıcı tercih hatırlar ve geçmişte anlamsal arama yapar. KVKK uyumlu (customer/staff hard delete olduğunda trigger ile hafıza temizlenir).
- `2026-04-23`: **AI Asistan Faz 3 — Skill Paketleri ve Sektör Bazlı Araç Yükleme**. `lib/ai/skills/` modülü (types/registry/loader), sektör → skill → araç eşlemesi, 6 yeni araç (4 estetik klinik: `list_protocols`, `get_protocol_details`, `list_customer_allergies`, `check_contraindications`; 2 diş kliniği: `list_tooth_records`, `update_tooth_record`), asistan route'una skill loader entegrasyonu. Artık her sohbette yalnızca o sektörle ilgili araçlar yükleniyor — bağlam küçüldü, token tasarrufu başladı.
- `2026-04-23`: **AI Asistan Faz 4 — Proaktif Danışman Katmanı**. 2 yeni migration (`064`, `065`), `lib/ai/watcher/event-handlers.ts` (no_show, overdue, churned, anomaly, slot_gap, pattern tespiti), 2 yeni cron (`ai-watcher`, `ai-pattern-detector`), insights API (`/api/ai/insights` + `[id]` + `count`), TopBar'da amber ampul ikonu + rozet, `ai-insights-drawer.tsx` (Fırsat/Risk/Öneri/Otomasyon kartları, Yap+Reddet butonları). Asistan artık personel sormadan işletmedeki riskleri ve fırsatları tespit eder.
- `2026-04-23`: **AI Asistan Faz 5 — Stratejik Planner + Forecast + Benchmark** (`ai-asistan` branch). 1 yeni migration (`066_sector_benchmarks_aggregate`), `/api/cron/ai-weekly-plan` (pazartesi 07:00 — sektör playbook + 4 haftalık KPI ile işletme başına haftalık plan → `ai_insights` kartları), `lib/analytics/forecast.ts` (30 gün gelir tahmini: lineer regresyon + R² + sezonsal çarpan + `simulateCampaign()`), 2 yeni asistan aracı (`forecast_revenue`, `simulate_campaign`) analytics skill'ine eklendi, `/api/ai/transcribe` Whisper için `getOpenAIClient()` + `WHISPER_MODEL` sabiti kullanımına geçirildi.
- `2026-04-23`: **Faz 5.3 tamamlama** (`ai-asistan` branch). Benchmark agregasyon cron'u `/api/cron/ai-benchmark-aggregate` yazıldı (opt-in işletmelerden son tamamlanmış çeyreği anonim agregeler; sample ≥ 20 şartı ile p25/p50/p75 hesaplar; `business_id` saklamaz). `BusinessSettings.benchmark_opt_in` tipi eklendi. `/dashboard/settings/ai` sayfasına "Sektörel Benchmark'a Katıl" opt-in toggle kartı eklendi.

---

## Yayın Öncesi Kilit Kontroller (Pre-Launch Checklist)

Proje tasarım aşamasında. Aşağıdakiler **production'a açılmadan önce** tamamlanmalı. Şu anda yokluk zararsız (saldırgan + gerçek veri yok), ancak yayın günü listenin tamamı kapatılmış olmalı.

### Güvenlik / Doğrulama (Kritik)
- [ ] `/api/consent` — auth kontrolü + `Zod` şeması + rate-limit
- [ ] `/api/book` — public endpoint; işletme ayarlarında sızıntı riski olan alanları response'tan çıkar
- [ ] Çift randevu oluşturma endpoint'lerini konsolide et (`/api/book` + `/api/public/business/[id]/book` arasında karar ver)
- [ ] Twilio webhook'larında imza doğrulaması zorunlu hale getir (şu an opsiyonel)
- [ ] `/api/ai/*` — her çağrıda `staff_members` membership kontrolü (mevcut plan + sektör izni)
- [ ] Portal / direct-login guard — portal sayfalarının dashboard auth bypass'i olmaması
- [ ] `Zod` validasyon eksik 10+ API route için şemalar yaz (öncelik: müşteri, randevu, fatura, mesaj)

### Kod Borcu (Gecikebilir, Yayın Öncesi Hafifletilmeli)
- [ ] `any` tip temizliği — AI route'ları, analytics, commissions modülünde yaygın
- [ ] API route'larında `console.error` → merkezi logger (şu an direkt konsola yazıyor; deploy sonrası observability için Sentry/logger'a geçilmeli)
- [ ] React hook deps warning'leri (~28 adet, `eslint-plugin-react-hooks`)
- [ ] `<img>` → `next/image` (~5 adet; performance + LCP için)
- [ ] Eksik alt text (~2 adet)

### UI Tutarlılık (Sürekli Bakım)
- [x] Native `<select>` → `CustomSelect` (tüm booking + register akışı 2026-04-18'de tamamlandı; yeni sayfa eklenirken kontrol et)
- [x] EmptyState ortak bileşen — 6 ana sayfa tamam; pos + messages layout placeholder olduğu için kapsam dışı
- [ ] Dark mode bg-white audit — public + auth sayfalarında dark override çakışması taranmalı
- [x] Modal overlay → Dialog — CLAUDE.md'deki `modal-overlay` pattern zaten Portal destekli olarak kullanılıyor, zorunlu migrasyon yok

---

## Supabase Migration Durumu

Aşağıdaki migration'lar Supabase SQL Editor'de manuel olarak çalıştırılmalıdır:
- `008_fix_shifts_trigger.sql` — shifts tablosunun updated_at trigger'ını moddatetime'dan bağımsız hale getirir (vardiye kaydetme için kritik)
- `035_rewards.sql` — `rewards` ve `customer_rewards` tabloları, RLS politikaları (ödül sistemi için gerekli)

### Uygulanan Migration'lar (Supabase'de çalıştırıldı)
- `006_create_shifts.sql` + `008_fix_shifts_trigger.sql` → **✅ Uygulandı (2026-03-19)**
- `027_whatsapp_enhancements.sql` → **✅ Uygulandı (2026-04-09)** — `customers.preferred_channel` kolonu, WA index
- `028_kvkk_compliance.sql` → **✅ Uygulandı (2026-04-09)** — `consent_records`, `data_deletion_requests` tabloları, RLS politikaları
- `040b_staff_write_permissions.sql` → **✅ Uygulandı (2026-04-15)** — `staff_members.write_permissions` JSONB kolonu (granüler Düzenle yetkisi)
- `053b_rewards_feature_flag.sql` → **✅ Uygulandı (2026-04-18)** — `businesses.settings.rewards_enabled` varsayılan değeri
- `054b_reviews_anonymous.sql` → **✅ Uygulandı (2026-04-18)** — `reviews.is_anonymous` kolonu + partial index
- `057_follow_up_reform.sql` → **✅ Uygulandı (2026-04-19)** — follow_up_queue status enum genişletme (in_progress, no_response, done, rescheduled), notes + status_history JSONB
- `058_shift_requests.sql` → **✅ Uygulandı (2026-04-21)** — `shift_requests` tablosu + 4 RLS politikası (personel talep → yönetici onay akışı)
- `061_ai_business_memory.sql` → **✅ Uygulandı (2026-04-23)** — AI asistan uzun vadeli hafıza tablosu + 4 RLS policy + updated_at trigger + KVKK cascade trigger'lar (customer/staff delete)
- `062_pgvector_embeddings.sql` → **✅ Uygulandı (2026-04-23)** — `vector` extension + `ai_embeddings` tablosu + IVFFlat index + `search_embeddings()` RPC + KVKK cascade
- `063_ai_conversation_summary.sql` → **✅ Uygulandı (2026-04-23)** — `ai_conversations.summary`, `summary_updated_at`, `message_count_at_summary` kolonları
- `064_ai_event_queue.sql` → **✅ Uygulandı (2026-04-23)** — `ai_event_queue` tablosu + RLS + index'ler (Faz 4 — proaktif danışman olayları)
- `065_ai_insights.sql` → **✅ Uygulandı (2026-04-23)** — `ai_insights` tablosu + RLS + index'ler (Faz 4 — insight kartları)
- `066_sector_benchmarks_aggregate.sql` → **✅ Uygulandı (2026-04-23)** — `sector_benchmarks_aggregate` tablosu + unique index (sector+metric+period) + RLS public read (Faz 5 — anonim sektörel benchmark, sample_size >= 20 şartı)

### Migration Numaralandırma Kuralı (2026-04-18'den itibaren)
Aynı numaraya denk gelen migration'lar `a/b/c` harf suffix'i ile ayrılır. Alfabetik sıralama doğru çalışma sırasını korur.
Örnek: `036a_fix_rewards_type_constraint.sql` → `036b_referral_status_simplify.sql`

Mevcut a/b çiftleri: `036a/036b`, `037a/037b`, `040a/040b`, `049a/049b`, `050a/050b`, `053a/053b`, `054a/054b`.

Son migration numarası: `066_sector_benchmarks_aggregate.sql` (2026-04-23, Faz 5).
