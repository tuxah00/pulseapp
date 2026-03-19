# Meta (Facebook) WhatsApp Kurulumu – Adım Adım Rehber

PulseApp için Meta tarafında yapmanız gereken tüm ayarlar. Her adımda **doğrudan link** verilmiştir; linke tıklayıp ilgili sayfaya gidebilirsiniz.

---

## 0. Giriş ve Uygulama Seçimi

1. **Meta for Developers’a gidin (Facebook ile giriş yapın):**  
   **https://developers.facebook.com**

2. **Uygulamalarım sayfası:**  
   **https://developers.facebook.com/apps**  
   Burada tüm uygulamalarınız listelenir. PulseApp için kullandığınız uygulamayı tıklayın.

3. **Uygulama yoksa yeni oluşturun:**  
   **https://developers.facebook.com/apps/creation/**  
   - Uygulama adı ve iletişim e-postası girin.  
   - “Use case” (Kullanım senaryosu) olarak **“Other”** veya **“Business”** seçin; WhatsApp için Business tipi uygulama gerekir.  
   - İşletme (Business) seçin veya oluşturun.  
   - Oluşturduktan sonra dashboard’a yönlendirilirsiniz.

4. **Belirli bir uygulamayı açmak (App ID’nizi biliyorsanız):**  
   **https://developers.facebook.com/apps/1638161004037662/**  
   *(1638161004037662 yerine kendi App ID’nizi yazın.)*

---

## 1. Temel Ayarlar (App ID ve App Secret)

1. Sol menüden **“Ayarlar”** (Settings) veya **“App settings”** → **“Temel” (Basic)** bölümüne gidin.  
   Doğrudan link (kendi App ID’nizi yazın):  
   **https://developers.facebook.com/apps/1638161004037662/settings/basic/**

2. Bu sayfada görünenler:
   - **Uygulama Kimliği (App ID):** Bunu `.env` ve Vercel’de `NEXT_PUBLIC_META_APP_ID` olarak kullanıyorsunuz.
   - **Uygulama Gizlisi (App Secret):** “Göster”e tıklayıp görün. Bunu **sadece sunucu tarafında** kullanın (örn. `META_APP_SECRET`); asla frontend’e koymayın.

3. **Uygulama Alanları (App Domains)** alanına sitenizin alan adını ekleyin (protokol olmadan):  
   Örnek: `pulseapp-mu.vercel.app`  
   Kaydedin.

---

## 2. Facebook Login / Facebook Login for Business Ayarları

Meta arayüzü sürümüne göre menü adı **“Facebook Login”** veya **“Facebook Login for Business”** olabilir. İkisi de aynı ayarlara götürür.

1. Sol menüde şunlardan birini bulun ve tıklayın:
   - **“Kullanım senaryoları” (Use cases)** açılır → **“Facebook Login for Business”** veya **“Facebook Login”**
   - veya doğrudan **“Ürünler” (Products)** → **“Facebook Login”**

2. **Ayarlar (Settings)** sekmesine gidin.  
   Olası doğrudan link (App ID’nizi yazın):  
   **https://developers.facebook.com/apps/1638161004037662/fb-login/settings/**

3. Bu sayfada **mutlaka** yapın:

   | Ayar | Değer | Açıklama |
   |------|--------|----------|
   | **Use Strict Mode for redirect URIs** | Açık (Yes) kalabilir | Güvenlik için iyi. |
   | **Valid OAuth Redirect URIs** | Aşağıdaki iki satırı **ayrı ayrı** ekleyin: | Giriş sonrası dönüş adresleri. |
   | | `https://pulseapp-mu.vercel.app/` | Ana site. |
   | | `https://pulseapp-mu.vercel.app/dashboard/settings/whatsapp/callback` | WhatsApp bağlantı callback’i. |
   | **Login with the JavaScript SDK** | **Evet (Yes)** | Popup/JS ile giriş için gerekli. |
   | **Allowed Domains for the JavaScript SDK** | `pulseapp-mu.vercel.app` | Sadece domain; `https://` yazmayın. |

4. **Save changes** (Değişiklikleri Kaydet) butonuna tıklayın.

**Not:** Kendi domain’iniz farklıysa (örn. `sizinsite.com`), yukarıdaki tüm URL ve domain’leri kendi domain’inizle değiştirin.

---

## 3. WhatsApp Ürünü ve Embedded Signup (Config)

1. Sol menüden **“WhatsApp”** bölümünü bulun ve tıklayın.  
   Olası link:  
   **https://developers.facebook.com/apps/1638161004037662/whatsapp-business/embedded-signup/**

2. **Embedded Signup** veya **“Embedded Signup Builder”** / **“Configuration”** gibi bir alt menü olabilir.  
   Burada:
   - WhatsApp Embedded Signup için bir **Configuration** oluşturulur.
   - Oluşturduğunuzda bir **Configuration ID** alırsınız.  
   PulseApp şu an **App ID**’yi config gibi kullanabiliyor; ayrı bir Configuration ID kullanmak isterseniz bunu kodda `config_id` olarak değiştirebilirsiniz.

3. **Quickstart** veya **“Başlarken”** kısmında webhook ve test bilgileri de görünebilir; webhook’u aşağıdaki bölümde ayarlayacaksınız.

---

## 4. Webhook (WhatsApp Mesajları İçin)

1. Sol menüde **“WhatsApp”** → **“Configuration”** (Yapılandırma) veya **“Webhooks”** bölümüne gidin.  
   Olası link:  
   **https://developers.facebook.com/apps/1638161004037662/webhooks/**

2. **Webhook** veya **“Callback URL”** alanına şunu yazın:  
   `https://pulseapp-mu.vercel.app/api/webhooks/meta-whatsapp`

3. **Verify token** (Doğrulama jetonu) alanına PulseApp’te kullandığınız token’ı yazın (örn. `pulseapp2026`).  
   Bu değer, Vercel ortam değişkeni **WHATSAPP_VERIFY_TOKEN** ile birebir aynı olmalı.

4. **Verify** (Doğrula) butonuna tıklayın. Meta, bu URL’ye bir GET isteği atar; PulseApp doğrulamayı yanıtlar. Doğrulama başarılı olursa kaydedin.

5. **Abonelikler (Subscribe):** **“messages”** (mesajlar) kutusunu işaretleyin. İsteğe bağlı olarak **“message_template_status_update”** vb. ekleyebilirsiniz; temel kullanım için **messages** yeterlidir.

6. Değişiklikleri kaydedin.

---

## 5. Özet Kontrol Listesi

- [ ] **Temel ayarlar:** App ID ve App Secret not edildi; App Domains’e `pulseapp-mu.vercel.app` (veya kendi domain’iniz) eklendi.
- [ ] **Facebook Login ayarları:**  
  - Valid OAuth Redirect URIs: `https://pulseapp-mu.vercel.app/` ve `https://pulseapp-mu.vercel.app/dashboard/settings/whatsapp/callback`  
  - Login with the JavaScript SDK: **Yes**  
  - Allowed Domains for the JavaScript SDK: `pulseapp-mu.vercel.app`
- [ ] **WhatsApp:** Embedded Signup / Configuration (isteğe bağlı ayrı Config ID) ayarlandı.
- [ ] **Webhook:** Callback URL ve Verify token girildi, **Verify** başarılı, **messages** abone edildi.

---

## 6. Ortam Değişkenleri (PulseApp / Vercel)

Meta tarafı tamamlandıktan sonra aşağıdakilerin tanımlı olduğundan emin olun:

| Değişken | Nereden | Açıklama |
|----------|--------|----------|
| `NEXT_PUBLIC_META_APP_ID` | Temel ayarlar → App ID | Frontend’de kullanılır (giriş butonu). |
| `META_APP_ID` | Aynı App ID | Sunucu tarafı (token değişimi vb.). |
| `META_APP_SECRET` | Temel ayarlar → App Secret | Sadece sunucu; asla frontend’e koymayın. |
| `META_WEBHOOK_VERIFY_TOKEN` | Sizin belirlediğiniz | Webhook doğrulama; Meta’daki “Verify token” ile aynı. |

---

## Yararlı Meta Dokümantasyon Linkleri

- Uygulama oluşturma: https://developers.facebook.com/docs/development/create-an-app/
- Facebook Login for Business: https://developers.facebook.com/docs/facebook-login/facebook-login-for-business/
- WhatsApp Embedded Signup: https://developers.facebook.com/docs/whatsapp/embedded-signup/
- WhatsApp Embedded Signup – Implementation: https://developers.facebook.com/docs/whatsapp/embedded-signup/getting-started
- Webhooks (genel): https://developers.facebook.com/docs/graph-api/webhooks/

---

*Bu rehber PulseApp WhatsApp entegrasyonu için hazırlanmıştır. Meta arayüzü güncellenirse menü isimleri veya linkler değişebilir; yukarıdaki alternatif yolları kullanarak ilgili ayarları bulun.*
