# PulseApp — Production Checklist

Canlıya çıkmadan önce her satır tik atılmış olmalıdır.

---

## 1. Ortam Değişkenleri (Vercel Dashboard → Settings → Environment Variables)

| Değişken | Durum | Not |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ☐ | Production Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ☐ | Production anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | ☐ | **Gizli** — asla public'e sızdırma |
| `OPENAI_API_KEY` | ☐ | GPT-4o Mini için |
| `TWILIO_ACCOUNT_SID` | ☐ | SMS gönderimi |
| `TWILIO_AUTH_TOKEN` | ☐ | **Gizli** |
| `TWILIO_PHONE_NUMBER` | ☐ | `+90...` formatında |
| `NEXT_PUBLIC_APP_URL` | ☐ | `https://app.pulseapp.com.tr` (production URL) |
| `CRON_SECRET` | ☐ | Güçlü random string (min 32 karakter) |
| `NEXT_PUBLIC_SENTRY_DSN` | ☐ | Sentry project DSN |
| `PAYTR_MERCHANT_ID` | ☐ | PayTR merchant hesabı açıldığında |
| `PAYTR_MERCHANT_KEY` | ☐ | **Gizli** |
| `PAYTR_MERCHANT_SALT` | ☐ | **Gizli** |
| `RESEND_API_KEY` | ☐ | E-posta bildirimleri |
| `TWILIO_WHATSAPP_NUMBER` | ☐ | WhatsApp Business onayından sonra |
| `SENTRY_AUTH_TOKEN` | ☐ | Source map upload için (opsiyonel) |
| `SENTRY_ORG` | ☐ | Sentry org slug |
| `SENTRY_PROJECT` | ☐ | Sentry project slug |

---

## 2. Supabase Production Ayarları

| Kontrol | Durum | Not |
|---|---|---|
| Tüm migration'lar uygulandı | ☐ | `supabase/migrations/` klasörü — en son: `060_photo_ai_analysis.sql` |
| RLS tüm tablolarda aktif | ☐ | Supabase Dashboard → Table Editor → her tabloda RLS ON |
| `customer-photos` bucket oluşturuldu | ☐ | Storage → Buckets |
| `records-files` bucket oluşturuldu | ☐ | Storage → Buckets |
| Email şablonları özelleştirildi | ☐ | Auth → Email Templates → Türkçe |
| Supabase Auth → Site URL ayarlandı | ☐ | `https://app.pulseapp.com.tr` |
| Supabase Auth → Redirect URL'ler eklendi | ☐ | Production + preview URL'ler |
| Point-in-time recovery (PITR) açık | ☐ | Supabase Pro'da → Database → PITR |

---

## 3. Vercel Ayarları

| Kontrol | Durum | Not |
|---|---|---|
| Production domain bağlandı | ☐ | `app.pulseapp.com.tr` → Vercel |
| SSL sertifikası aktif | ☐ | Vercel otomatik sağlar |
| Deploy sadece `main` branch | ☐ | `vercel.json` `ignoreCommand` ✅ yapıldı |
| Cron job'lar aktif | ☐ | Vercel Pro gerekir — `vercel.json` `crons` bölümü |
| Build başarılı (son deploy yeşil) | ☐ | Vercel Dashboard → son deploy |

---

## 4. Üçüncü Taraf Servisler

| Servis | Durum | Kontrol |
|---|---|---|
| **Twilio SMS** | ☐ | Test SMS gönder → gerçek telefona ulaşıyor mu? |
| **Twilio WhatsApp** | ☐ | Sandbox → Production onayı alındı mı? |
| **OpenAI** | ☐ | API key çalışıyor, rate limit yeterli mi? |
| **PayTR** | ☐ | Merchant hesabı onaylandı, webhook URL ayarlandı mı? |
| **Resend** | ☐ | Domain doğrulandı, test e-postası gitti mi? |
| **Sentry** | ☐ | Test hatası fırlat → Sentry'de görünüyor mu? |
| **Google Places** | ☐ | API key kısıtlandı mı (referrer/IP)? |

---

## 5. Güvenlik

| Kontrol | Durum | Not |
|---|---|---|
| `.env.local` git'e commit edilmedi | ☐ | `git log --all -- .env.local` → boş olmalı |
| `SUPABASE_SERVICE_ROLE_KEY` client'a sızmıyor | ☐ | `NEXT_PUBLIC_` prefix'i yok |
| Twilio webhook imzası doğrulanıyor | ☐ | `lib/webhooks/twilio-verify.ts` aktif mi? |
| PayTR webhook HMAC doğrulanıyor | ☐ | `lib/billing/paytr.ts` → hash kontrolü |
| `CRON_SECRET` tüm cron route'larında kontrol ediliyor | ☐ | `/api/cron/*` — secret header zorunlu |
| Admin client sadece API route'larında | ☐ | `createAdminClient()` client component'te yok |

---

## 6. Performans & Monitoring

| Kontrol | Durum | Not |
|---|---|---|
| Lighthouse PWA skoru > 90 | ☐ | Chrome DevTools → Lighthouse |
| Core Web Vitals (LCP < 2.5s) | ☐ | Vercel Speed Insights veya PageSpeed |
| Sentry error rate = 0 (ilk 24 saat) | ☐ | Sentry Dashboard → Issues |
| Vercel Analytics açık | ☐ | Vercel Dashboard → Analytics |
| Database index'leri oluşturuldu | ☐ | Supabase → Database → Indexes |

---

## 7. İçerik & UI

| Kontrol | Durum | Not |
|---|---|---|
| PWA ikonları yüklendi | ☐ | `/public/icons/icon-192.png` ve `icon-512.png` |
| Tüm metinler Türkçe | ☐ | Özellikle error mesajları, boş durumlar |
| Dark mode tüm sayfalarda çalışıyor | ☐ | Her sayfayı dark mode'da gözden geçir |
| Mobil görünüm (375px) sorunsuz | ☐ | Chrome DevTools → iPhone SE |
| Favicon güncellendi | ☐ | `/public/favicon.ico` |

---

## 8. Smoke Test Sonuçları

E2E testleri production URL'e karşı çalıştır:
```bash
PLAYWRIGHT_BASE_URL=https://app.pulseapp.com.tr \
TEST_EMAIL=pilot@musteri.com \
TEST_PASSWORD=gercek-sifre \
TEST_BUSINESS_ID=<business-uuid> \
npx playwright test tests/e2e/smoke/
```

| Test | Durum |
|---|---|
| Giriş akışı | ☐ |
| Randevu oluşturma | ☐ |
| Müşteri ekleme | ☐ |
| Haftalık takvim | ☐ |
| Fatura oluşturma | ☐ |
| AI asistan | ☐ |
| Portal booking | ☐ |
| Analytics + PDF | ☐ |
| Yetki matrisi | ☐ |

---

## 9. Pilot Müşteri Hazırlığı

| Kontrol | Durum | Not |
|---|---|---|
| Pilot işletme hesabı oluşturuldu | ☐ | `pulseapp@gmail.com` değil, gerçek hesap |
| Seed verisi temizlendi | ☐ | `[SEED]` tag'li müşteriler silindi |
| Pilot kullanıcıya demo yapıldı | ☐ | Randevu → Müşteri → Mesaj akışı gösterildi |
| Destek kanalı tanımlandı | ☐ | WhatsApp / email destek hattı hazır |
| Yedek planı var | ☐ | Veri kaybı senaryosunda ne yapılacak? |

---

**Tüm satırlar tik atıldıktan sonra canlıya çıkılabilir.** 🚀
