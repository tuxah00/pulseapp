# PulseApp — Vercel Production Kurulumu

## 1. Proje yapısı

- **Root Directory:** Repo kökü `pulseapp-v2-fixed` ise Vercel’de **Root Directory** olarak `pulseapp` seçin (uygulama bu klasörde).
- **Framework Preset:** Next.js (otomatik algılanır).
- **Build Command:** `next build` (varsayılan).
- **Output Directory:** `.next` (varsayılan).
- **Install Command:** `npm install` (varsayılan).

---

## 2. Vercel ortam değişkenleri (Environment Variables)

Vercel → Proje → **Settings** → **Environment Variables** bölümüne aşağıdakileri ekleyin. Production için **Production** ortamını seçin.

### Zorunlu (uygulama açılır, temel özellikler çalışır)

| Değişken | Açıklama | Örnek |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase proje URL | `https://xxxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | `eyJhbGciOi...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (gizli) | `eyJhbGciOi...` |
| `NEXT_PUBLIC_APP_URL` | Canlı site adresi | `https://pulseapp-mu.vercel.app` |
| `CRON_SECRET` | Cron/hatırlatma API güvenliği | Rastgele güçlü string |

### Opsiyonel (özelliği kullanacaksanız doldurun)

| Değişken | Açıklama |
|----------|----------|
| `ANTHROPIC_API_KEY` | Claude AI (mesaj sınıflandırma vb.) |
| `META_APP_ID` | Meta WhatsApp Cloud API – App ID |
| `META_APP_SECRET` | Meta WhatsApp Cloud API – App Secret |
| `NEXT_PUBLIC_META_APP_ID` | Meta App ID (client tarafı, WhatsApp bağlantı sayfası) |
| `WHATSAPP_VERIFY_TOKEN` | Webhook doğrulama tokeni (Meta’da tanımladığınız) |
| `WHATSAPP_ENCRYPTION_KEY` | 32 byte hex (örn. `openssl rand -hex 32`) |
| `TWILIO_ACCOUNT_SID` | Twilio (legacy WhatsApp) |
| `TWILIO_AUTH_TOKEN` | Twilio |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp numarası |
| `PAYTR_MERCHANT_ID` | PayTR ödeme |
| `PAYTR_MERCHANT_KEY` | PayTR |
| `PAYTR_MERCHANT_SALT` | PayTR |
| `RESEND_API_KEY` | E-posta (Resend) |
| `GOOGLE_PLACES_API_KEY` | Google Places (adres/konum) |

---

## 3. Hızlı kopyala-yapıştır (minimum production)

Sadece Supabase + site URL + cron güvenliği ile yayına almak için:

```
NEXT_PUBLIC_SUPABASE_URL=https://PROJE_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://SIZIN-VERCEL-DOMAIN.vercel.app
CRON_SECRET=buraya-uzun-rastgele-bir-sifre-yazin
```

---

## 4. Vercel Cron (randevu hatırlatmaları)

Hatırlatma API’sini zamanlı çalıştırmak için Vercel’de **Cron Job** tanımlayın:

- **Path:** `api/cron/reminders`
- **Schedule:** İhtiyaca göre (örn. her 15 dk: `*/15 * * * *`)

Vercel Dashboard → Proje → **Settings** → **Cron Jobs** (veya `vercel.json` ile aşağıdaki gibi):

```json
{
  "crons": [
    { "path": "/api/cron/reminders", "schedule": "*/15 * * * *" }
  ]
}
```

`CRON_SECRET` ile istekleri korumak için cron isteğinde `Authorization: Bearer CRON_SECRET` veya projenizde tanımlı header/query kontrolünü kullanın.

---

## 5. Supabase migration (segment hatası düzeltmesi)

Randevu “Tamamlandı” / onaylama hatasını önlemek için Supabase’te migration’ı çalıştırın:

1. Supabase Dashboard → **SQL Editor** → New query.
2. `supabase/migrations/003_fix_appointment_customer_segment.sql` dosyasının içeriğini yapıştırın.
3. Run.

---

## 6. Kontrol listesi

- [ ] Root Directory: `pulseapp` (repo kökü üst klasörse).
- [ ] `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` tanımlı.
- [ ] `NEXT_PUBLIC_APP_URL` production domain’e ayarlı (https ile).
- [ ] `CRON_SECRET` güçlü ve rastgele.
- [ ] İsteğe bağlı: WhatsApp / ödeme / e-posta key’leri eklenmiş.
- [ ] Supabase’te `003_fix_appointment_customer_segment.sql` çalıştırılmış.
- [ ] Deploy sonrası giriş / randevu / müşteri sayfalarını test edin.

Bu adımlarla proje Vercel production’da çalışır.
