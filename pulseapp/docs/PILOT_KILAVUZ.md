# PulseApp Pilot Kullanım Kılavuzu

Bu kılavuz pilot süresince personel ve müşteriler için PulseApp'in nasıl kullanılacağını anlatır. Pilot süresince **ödeme alınmaz**, **otomatik SMS/WhatsApp gönderilmez** ve **e-fatura kesilmez**. Bu özellikler aboneliğiniz başladığında aktif olur.

## Pilot Modunu Aktifleştirme

İşletmenin `settings.pilot_mode` alanı `true` olduğunda pilot davranışı otomatik devreye girer. Bu Supabase üzerinde tek seferlik ayarlanır:

```sql
UPDATE businesses SET settings = settings || '{"pilot_mode": true}'::jsonb WHERE id = '<businessId>';
```

Pilot tamamlandığında aynı değer `false` yapılır; ödeme/SMS/WhatsApp/e-fatura akışları otomatik geri gelir.

---

## Personel İçin

### 1. Giriş ve İlk Kurulum
- `pulseapp.com/auth/login` üzerinden e-posta + şifre ile giriş.
- İlk girişte sektör + işletme bilgileri istenir (mevcut onboarding formu).
- Üstte **amber renkli "Pilot modu aktif"** uyarı bandını göreceksiniz; bu bandı 24 saat boyunca gizleyebilirsiniz.

### 2. Randevu, Müşteri, Fatura
Tüm ana CRUD akışları normal çalışır:
- **Randevular** → /dashboard/appointments — takvim, drag-drop, tekrarlayan randevu
- **Müşteriler** → /dashboard/customers — segment, geçmiş, alerji, ödüller
- **Faturalar** → /dashboard/invoices — kalem ekle, ödeme yöntemi, ödendi işaretle

Pilot süresince **e-fatura gönder butonu fatura detayında görünmez** (Paraşüt aboneliği gerektiriyor). Aboneliğiniz başladığında otomatik geri gelir.

### 3. Mesajlaşma — In-App Bildirim Olarak
Pilot süresince Twilio aktif olmadığı için **SMS / WhatsApp gönderilemez**. Bunun yerine:
- Mesaj göndermek istediğinizde sistem mesajı `messages` tablosuna `web` kanalı olarak kaydeder.
- Aynı anda personele **bildirim çanına (üst sağ köşe)** "WhatsApp bekliyor (pilot): Müşteri Adı — telefon" şeklinde bir kayıt düşer.
- Personel müşteriyi telefon veya WhatsApp uygulaması üzerinden manuel arayarak/yazarak iletişime geçer.

Bu davranış aşağıdaki yerleri etkiler:
- Mesajlar paneli (manuel mesaj)
- Hatırlatmalar / Doğum günü / Yorum istekleri (otomasyon paneli)
- Müşteri portal'dan gelen ödeme bildirimleri (notification olarak düşer)

### 4. Otomasyonlar Paneli — Manuel Tetik
Vercel Cron yok; otomatik gönderimler için yeni bir panel:
**/dashboard/automations** → 4 kart:
1. **Randevu Hatırlatmaları** — yarınki 24h, bugünkü 2h hatırlatmalar
2. **Doğum Günü Kutlamaları** — bugün doğan müşterilere mesaj
3. **Yorum İstekleri** — tamamlanmış randevular için yorum daveti
4. **Müşteri Segmentleri (Winback)** — Risk/Kayıp etiketleme

Her kartın **"Şimdi Çalıştır"** butonu var. Önerilen kullanım:
- Sabah açılışta: Randevu Hatırlatmaları + Doğum Günü
- Gün sonunda: Yorum İstekleri + Winback

Sonuç toast'u kaç bildirim üretildiğini gösterir; "automations_log" tablosuna kayıt düşer.

### 5. Ödeme — Manuel İşaretleme
PayTR aboneliği yok; ödeme alımı tamamen manuel:
- Müşteri öderse personel **fatura kartında "Ödendi olarak işaretle"** butonuna basar.
- Müşteri portalden **"Ödediğimi Bildir"** formu kullanırsa **bildirim çanına** "Ödeme bildirimi: Müşteri Adı — Fatura No" kaydı düşer. Personel detayları kontrol edip onaylar (manuel olarak fatura ödendi işaretlenir).

### 6. Ödüller — Personel Onaylı
Müşteri portal'dan bir ödül için **"Şimdi Kullan"** butonuna basarsa:
- Bildirim çanına "Ödül talebi: Müşteri Adı" düşer.
- Personel müşteri yanına geldiğinde Ödüller panelinde ilgili ödülü "Kullanıldı" olarak işaretler (mevcut akış).
- Aynı talep 30 dakika içinde tekrar gönderilemez (idempotency).

### 7. Geri Bildirim
Müşteri portal'dan şikayet/öneri/teşekkür/soru gönderirse **bildirim çanına** "Yeni Geri Bildirim" düşer. Reviews panelinden yanıtlanır.

### 8. Müşteri Portal Daveti
Müşteri detay panelinde (Müşteriler > müşteri seç > Bilgiler tab'ı) **"Müşteri Portali"** kartı:
- Müşterinin doğum tarihi varsa: **"Linki Kopyala"** ve **"Davet Mesajı"** butonları.
- Doğum tarihi yoksa: uyarı (önce doğum tarihini ekleyin).

Davet mesajı şablonu:
> Sayın [Ad], kişisel müşteri sayfanız hazır: [link]
> Giriş için telefon numaranız ve doğum tarihinizi kullanın.

Bunu WhatsApp veya SMS uygulamanıza yapıştırıp müşteriye gönderin.

---

## Müşteri İçin

### 1. Portala Giriş
Davet linki: `pulseapp.com/portal/<isletmeId>`

Pilot süresince giriş için iki bilgi gerekir:
- **Telefon numarası** (işletmeye verdiğiniz)
- **Doğum tarihi** (işletmeye verdiğiniz)

Doğru girilirse hemen dashboard açılır.
Bilgileriniz eşleşmezse "Bilgiler eşleşmedi" mesajı görürsünüz; 5 dakikada en fazla 10 deneme hakkınız vardır.

### 2. Dashboard Sayfaları
- **Özet** → yaklaşan randevular, ödüller
- **Randevular** → geçmiş + gelecek randevular, link paylaş, düzenle/iptal
- **Tedaviler** (klinik) → protokol seansları
- **Faturalar** → fatura listesi, PDF indir
- **Dosyalar** → röntgen, kayıt, fotoğraflar
- **Yorumlar** → yorum yaz, görüntüle
- **Geri Bildirim** → şikayet/öneri/teşekkür gönder
- **Ödüller** → puan + kullanılabilir ödüller
- **Ayarlar** → profil düzenle, veri silme talebi

### 3. Randevu Yönetimi
- **Linki Paylaş** butonu randevu kartında: tek tık ile randevu yönetim linki kopyalanır (yakınlarınıza gönderebilirsiniz).
- **Düzenle** butonu: tarih/saat değiştirme talebi (personel onayına düşer).
- **İptal** butonu: anında iptal eder.

### 4. Ödeme Bildirimi
Fatura detay sayfasında (henüz ödenmemiş faturalar için):
- **"Ödediğimi Bildir"** butonu → tarih + yöntem (havale/nakit/kart/diğer) + tutar + opsiyonel IBAN son 4 + not formu.
- Bildirimi gönderdikten sonra "Talebiniz iletildi" mesajı görürsünüz.
- Personel onayladığında fatura "Ödendi" olarak işaretlenir.
- Aynı fatura için bekleyen başka bir bildiriminiz varsa yenisini gönderemezsiniz.

### 5. Ödül Kullanma
Ödüller sayfasında her **"Kullanıma Hazır"** ödül kartında:
- **"Şimdi Kullan"** butonu → personele talep notification'ı düşer.
- 30 dakika içinde aynı ödül için tekrar talep gönderemezsiniz.
- Personel müşteri yanına geldiğinde ödülü onaylar ve "Kullanıldı" yapar.

### 6. Geri Bildirim Formu
4 kategori var: Teşekkür, Öneri, Şikayet, Soru. Konu (opsiyonel) + mesaj (max 1000 karakter). İşletme yanıtladığında portal'da görürsünüz.

---

## Pilot Kısıtlamaları (Hatırlatma)

Pilot süresince **çalışmayan** özellikler:

| Özellik | Durum | Aboneliği Gelince |
|---------|-------|-------------------|
| SMS gönderimi | Yok — bildirim olarak personele iletim | Twilio devreye girer |
| WhatsApp gönderimi | Yok — bildirim olarak personele iletim | Twilio veya Meta Cloud |
| Otomatik cron (hatırlatma vb.) | Yok — manuel "Şimdi Çalıştır" | Vercel Pro cron tetikler |
| PayTR ödeme | Yok — manuel "Ödendi işaretle" | PayTR merchant hesabı |
| e-Fatura (Paraşüt) | Yok — UI'da gizli | Paraşüt API |
| Kampanyalar (toplu mesaj) | Sidebar'dan gizli | Twilio + Vercel Pro |

Bu özelliklerin **kodu hazır**, sadece dış servis/abonelik bekliyor.

---

## Sorun Giderme

**Müşteri portala giremiyor.**
- Telefon numarası DB'de aynı format mı? `+90...` veya `0...` ile yazılmış olabilir; sistem her ikisini de tanır.
- Doğum tarihi DB'de doluysa eşleşmesi gerekir. Müşterinin hatırladığı tarihle DB'deki uyuşuyor mu kontrol edin.

**Bildirim çanı boş ama mesajlar gitmiyor.**
- Üst sağ köşedeki çan ikonuna tıklayın. Pilot bildirimler `pilot_message_pending` tipinde gelir.
- Bell'in yanında kırmızı badge varsa okunmamış bildirim var demektir.

**Otomasyonlar panelinde "Çalıştır" butonu hata veriyor.**
- Sadece **Yönetici** veya **İşletme Sahibi** rolündeki personel manuel tetik yapabilir. Personel rolündeyseniz yöneticinize haber verin.

**TypeScript: pre-existing campaigns warning**
- `app/api/campaigns/route.ts` ile ilgili `next/types` warning'i pilot dışı, eski bir teknik borç. Build'i etkilemez.
