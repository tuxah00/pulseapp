Kodu incele ve iyileştir: $ARGUMENTS

İnceleme alanları:

**1. Güvenlik**
- `confirm()` kullanımı var mı? → `useConfirm()` ile değiştir
- XSS: kullanıcı girdisi doğrudan HTML'e mi ekleniyor?
- SQL injection: ham sorgu var mı?
- Kimlik doğrulama: her API endpoint'te `getUser()` kontrolü var mı?
- RLS bypass: `createAdminClient()` gereksiz yerde kullanılıyor mu?

**2. Kod Kalitesi**
- `console.log` debug kaldı mı?
- `any` tipi gereksiz yerde kullanılıyor mu?
- Tekrar eden kod var mı? → Ortak bileşene/hook'a çıkar
- `useEffect` bağımlılık array'i eksik mi?
- State'ler gereksiz yerde mı? (türetilebilir değerler için `useMemo` kullan)

**3. Performans**
- N+1 sorgu var mı? → `Promise.all` kullan
- Gereksiz re-render var mı?
- Büyük listeler sayfalama olmadan mı yükleniyor?
- `useCallback`/`useMemo` eksik mi?

**4. Türkçe UI**
- Tüm kullanıcıya görünen metinler Türkçe mi?
- Hata mesajları Türkçe mi?
- Placeholder ve label'lar Türkçe mi?

**5. Dark Mode**
- Tüm renk class'larında `dark:` variant var mı?
- `bg-gray-*` class'larında globals.css override'ından kaçmak için `dark:bg-white/X` gerekiyor mu?

Bulgular için: düzeltmeleri doğrudan uygula, sonra `npx tsc --noEmit` ile kontrol et.
