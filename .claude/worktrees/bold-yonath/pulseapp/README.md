# PulseApp

AI destekli küçük işletme yönetim platformu.

## Hızlı Başlangıç

### 1. Projeyi kur

```bash
# Repoyu klonla (veya dosyaları kopyala)
cd pulseapp

# Bağımlılıkları yükle
npm install

# Ortam değişkenlerini ayarla
cp .env.example .env.local
# .env.local dosyasını düzenle ve değerleri doldur
```

### 2. Supabase'i kur

1. [supabase.com](https://supabase.com) → Yeni proje oluştur (Region: Frankfurt)
2. **SQL Editor** → `supabase_schema.sql` dosyasının içeriğini yapıştır ve çalıştır
3. **Settings → API** → `Project URL` ve `anon key` değerlerini `.env.local`'a yaz
4. **Settings → API** → `service_role key`'i de `.env.local`'a yaz

### 3. Çalıştır

```bash
npm run dev
```

Tarayıcıda [http://localhost:3000](http://localhost:3000) adresini aç.

### 4. İlk kullanıcı

1. `/auth/register` sayfasından kayıt ol
2. İşletme bilgilerini doldur
3. Dashboard'a yönlendirileceksin

## Klasör Yapısı

```
pulseapp/
├── app/
│   ├── auth/           ← Giriş, kayıt, callback
│   ├── dashboard/      ← Ana uygulama sayfaları
│   ├── api/            ← Backend API route'ları
│   └── page.tsx        ← Landing page
├── components/         ← React bileşenleri
├── lib/
│   └── supabase/       ← Supabase client (browser, server, admin)
├── types/              ← TypeScript tipleri
└── middleware.ts       ← Auth koruması
```

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (PostgreSQL + Auth + Realtime)
- **Tailwind CSS**
- **TypeScript**
- **Vercel** (Hosting)
