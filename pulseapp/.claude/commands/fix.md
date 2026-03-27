Şu hatayı/sorunu düzelt: $ARGUMENTS

Adımlar:
1. Sorunu anlayarak ilgili dosya(lar)ı oku
2. Kök nedeni tespit et — yüzeysel semptom değil, asıl sorun nerede?
3. En minimal düzeltmeyi uygula — gerekmeyen hiçbir şeyi değiştirme
4. Güvenlik kontrolleri:
   - SQL injection riski var mı?
   - XSS açığı oluşuyor mu?
   - RLS bypass var mı?
   - Kimlik doğrulama atlanıyor mu?
5. TypeScript kontrolü: `cd pulseapp && npx tsc --noEmit`
6. Build kontrolü: `cd pulseapp && npm run build 2>&1 | tail -20`
7. Commit: `fix: [düzeltme açıklaması]`
8. Push: `git push`
