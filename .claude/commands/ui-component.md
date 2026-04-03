Yeni bir UI bileşeni oluştur: $ARGUMENTS

Adımlar:
1. Mevcut benzer bileşenleri incele: `components/ui/` ve `components/dashboard/` klasörlerini oku
2. Bileşeni oluştur:
   - Konum: `components/ui/[bileşen-adı].tsx` (yeniden kullanılabilir) veya `components/dashboard/[bileşen-adı].tsx` (dashboard'a özel)
   - `'use client'` directive ekle (state/event varsa)
   - TypeScript interface ile props tanımla
   - Tailwind CSS kullan — inline style KULLANMA
   - Dark mode: her renk class'ına `dark:` variant ekle
   - Animasyonlar: `modal-overlay` / `modal-content` / `slide-panel` class'larını kullan
   - Türkçe default metin değerleri
3. Erişilebilirlik:
   - Butonlara `aria-label` ekle (metin yoksa)
   - Modal'lara ESC kapatma ekle
   - Focus trap gerekiyorsa uygula
4. Bileşeni kullanan sayfayı güncelle
5. TypeScript kontrolü: `cd pulseapp && npx tsc --noEmit`
6. Commit: `feat: add [bileşen adı] component`
