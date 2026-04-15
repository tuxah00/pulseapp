import type { SectorType } from '@/types'

// ============================================
// Stratejik Sektör Kütüphanesi — Faz 12
// Her sektör için mevsimsel kalıp, kâr sürücüleri,
// elde tutma kancaları, KPI hedefleri ve playbook'lar.
// ============================================

export type SeasonalDemand = 'low' | 'normal' | 'high' | 'peak'

export interface SeasonalPattern {
  /** 1-12 (Ocak-Aralık) */
  month: number
  demand: SeasonalDemand
  note: string
}

export interface KpiTarget {
  metric: string
  target: string
  why: string
}

export interface Playbook {
  trigger: string
  action: string
  expected_impact: string
}

export interface SectorStrategy {
  seasonal: SeasonalPattern[]
  profit_drivers: string[]
  margin_leaks: string[]
  retention_hooks: string[]
  kpi_targets: KpiTarget[]
  playbooks: Playbook[]
}

// Aylık seasonal iskeletler — dolulukla ilişkili. Her sektörde 12 ay tanımlı.
const STANDARD_SEASONAL: SeasonalPattern[] = Array.from({ length: 12 }, (_, i) => ({
  month: i + 1,
  demand: 'normal',
  note: 'Tipik talep düzeyi',
}))

function buildSeasonal(
  overrides: Partial<Record<number, { demand: SeasonalDemand; note: string }>>,
): SeasonalPattern[] {
  return STANDARD_SEASONAL.map(base => {
    const o = overrides[base.month]
    return o ? { ...base, ...o } : base
  })
}

// ── Öncelikli sektörler (tam içerik) ──

const MEDICAL_AESTHETIC: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'low', note: 'Yılbaşı sonrası sakin dönem — ürün fırsatı' },
    2: { demand: 'normal', note: 'Sevgililer günü paketleri devreye girebilir' },
    3: { demand: 'high', note: 'Yaz öncesi lazer ve kilo/selülit başvuruları artar' },
    4: { demand: 'high', note: 'Düğün/mezuniyet hazırlığı talebi yükselir' },
    5: { demand: 'peak', note: 'Bikini hazırlığı, lazer epilasyon ve cilt bakımı zirvede' },
    6: { demand: 'peak', note: 'Yoğun sezon — fiyat indirimi YERİNE yüksek değerli paket sat' },
    7: { demand: 'high', note: 'Sezon içi devam — yeni başlayanlara mini paket teklifi' },
    8: { demand: 'normal', note: 'Tatilde gidenler — otomatik hatırlatıcı şart' },
    9: { demand: 'high', note: 'Okul/iş dönüşü "yeni başlangıç" temalı paketler' },
    10: { demand: 'high', note: 'Cilt bakımı ve dolgu için ideal mevsim başlangıcı' },
    11: { demand: 'normal', note: 'Black Friday — ürün satışı için kritik hafta' },
    12: { demand: 'high', note: 'Yılbaşı hediye çeki ve paket satışı yüksek' },
  }),
  profit_drivers: [
    'Seanslı paketler (lazer, bölgesel zayıflama) tek işlemden %30-40 daha kârlıdır',
    'Cilt ürünü satışı (serum, güneş koruyucu) hizmet marjına %15-25 ek yapar',
    'Üst satış (mezoterapi + karboksi) ortalama bileti %50+ artırır',
    'Tedavi protokolü tamamlanma oranı %80 üstünde CLV 2 katına çıkar',
  ],
  margin_leaks: [
    'Tek seans indirimi müşteriyi paketten uzaklaştırır — ortalama bileti düşürür',
    'Randevu gelmeme (%10+ no-show) doğrudan kâra yansır; 24 saat önce onay şart',
    'Yüksek maliyetli cihaz hizmetlerinde düşük fiyat → cihaz amortismanı karşılanamaz',
  ],
  retention_hooks: [
    'Seans sonrası 3. gün whatsapp takip → bir sonraki randevu oranı %40 artar',
    'Protokol tamamlayan hastaya "bakım paketi" teklifi → CLV 2x',
    'Doğum günü ayında mini bakım hediyesi → tekrar gelme %60',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%45-55', why: 'Cihaz + sarf + personel sonrası sağlıklı bant' },
    { metric: 'Doluluk', target: '%70+', why: 'Sabit giderleri (kira, cihaz amortismanı) karşılamak için' },
    { metric: 'Paket/tek seans oranı', target: '%60 paket', why: 'Tek seans müşterisi düşük CLV' },
    { metric: 'No-show oranı', target: '<%5', why: 'Her no-show doğrudan kâr kaybı' },
  ],
  playbooks: [
    { trigger: 'Mart-Mayıs arası', action: '"Yaza Hazırlık" lazer paketi kampanyası; 3 seans bedeli 4 seans', expected_impact: 'Nisan-Mayıs cirosunda +%20-30' },
    { trigger: 'Ağustos sakinliği', action: 'Sadık müşterilere "tatil sonrası cilt onarımı" kampanyası', expected_impact: 'Eylül dolulukta +%15' },
    { trigger: 'Boş öğle slotları %50+', action: 'Öğle arası %15 cilt bakımı indirimi (iş günleri 11:00-14:00)', expected_impact: '+10 randevu/hafta' },
    { trigger: 'Kasım 4. hafta', action: 'Black Friday sadece ürün (%25) — hizmet indirimi YOK', expected_impact: 'Ürün ciro +%40' },
    { trigger: 'Protokol 2. seans tamamlanmadı', action: '7 gün içinde hatırlatıcı + %10 devam indirimi (sadece protokol içinde)', expected_impact: 'Tamamlanma oranı +%25' },
  ],
}

const DENTAL_CLINIC: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'normal', note: 'Yılbaşı sonrası "bu yıl dişlerimi düzeltirim" talebi' },
    2: { demand: 'normal', note: 'Beyazlatma ve implant danışma artışı' },
    3: { demand: 'high', note: 'Bahar temizliği ve kontrol yükselir' },
    4: { demand: 'high', note: 'Mezuniyet/düğün için estetik (veneer, ortodonti) talebi' },
    5: { demand: 'peak', note: 'Beyazlatma ve gülüş tasarımı zirvede' },
    6: { demand: 'high', note: 'Tatil öncesi implant/ortodonti başlatma yoğun' },
    7: { demand: 'low', note: 'Tatil dönemi — acil tedaviler dışı sakin' },
    8: { demand: 'normal', note: 'Okul öncesi çocuk muayene talebi' },
    9: { demand: 'high', note: 'Sağlık sigortası yenilenmesi → ertelenen tedaviler' },
    10: { demand: 'high', note: 'Kontrol ve dolgu için ideal dönem' },
    11: { demand: 'normal', note: 'Kasım — yıl sonu öncesi karar verme' },
    12: { demand: 'high', note: 'Yıl sonu bütçe kullanımı — büyük tedaviler' },
  }),
  profit_drivers: [
    'İmplant ve gülüş tasarımı tek tedavide yüksek kâr (15-50bin₺ ciro)',
    'Ortodonti 18-24 ay düzenli gelir akışı + düşük ayrılma',
    'Periyodik kontrol hatırlatması → yıllık 2 temizlik = stabil gelir',
    '3 aylık kontrol hatırlatan klinikler %40 daha yüksek yıllık ciro',
  ],
  margin_leaks: [
    'İlk muayene ücretsiz ama dönüşmeyen hasta — muayene zamanı kaybı',
    'Randevuya gelmeyen ortodonti hastası cihaz maliyetini karşılayamaz',
    'Uzun dönem ödeme planında takip zayıf → alacak birikir',
  ],
  retention_hooks: [
    '6 ayda bir otomatik kontrol hatırlatıcı → tekrar gelme %70',
    'Tedavi planı tamamlandıktan 3 ay sonra memnuniyet + bakım önerisi',
    'Aile indirimleri (ikinci çocuk %20) → yeni hasta kazanımı',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%40-50', why: 'Lab + sarf + koltuk maliyeti sonrası' },
    { metric: 'Yeni hasta muayene → tedavi dönüşümü', target: '%60+', why: 'Ücretsiz muayene yatırımını geri kazanmak için' },
    { metric: '6 aylık kontrol dönüş oranı', target: '%50+', why: 'Sürekli gelir için' },
  ],
  playbooks: [
    { trigger: 'Yılbaşı (Ocak)', action: '"Yeni Yılda Yeni Gülüş" beyazlatma + temizlik paketi', expected_impact: 'Ocak cirosunda +%25' },
    { trigger: 'Mayıs (düğün/mezuniyet öncesi)', action: 'Gülüş tasarımı ücretsiz danışma haftası', expected_impact: '5-10 yeni implant/veneer vaka' },
    { trigger: 'Periyodik kontrol tarihi yaklaşan hasta', action: 'Otomatik 14 gün önce SMS + online randevu linki', expected_impact: 'Dönüş +%40' },
    { trigger: 'Boş koltuk saati', action: 'Sadık hasta listesine ertesi gün için hızlı kontrol teklifi', expected_impact: '3-5 ek randevu/hafta' },
  ],
}

const HAIR_SALON: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'low', note: 'Yılbaşı sonrası sakinlik — sadık müşterilere ulaş' },
    3: { demand: 'high', note: 'Bahar renk değişimi talebi' },
    4: { demand: 'high', note: 'Düğün/mezuniyet hazırlığı' },
    5: { demand: 'peak', note: 'Düğün sezonu — saç yapımı talep zirvede' },
    6: { demand: 'peak', note: 'Tatil öncesi renk/kesim zirvesi' },
    7: { demand: 'high', note: 'Yaz — açık renk talebi sürüyor' },
    9: { demand: 'high', note: 'Okul/iş başlangıcı kesim talebi' },
    12: { demand: 'peak', note: 'Yılbaşı/yeni yıl styling talebi zirvede' },
  }),
  profit_drivers: [
    'Saç boyası + bakım paketi tek kesime göre %40 daha kârlı',
    'Profesyonel ürün satışı (şampuan, maske) %50 brüt marj',
    'Aynı müşteriden ayda 1 randevu → yıllık 12 ziyaret hedefi',
  ],
  margin_leaks: [
    'Tek seans kesim indirimi ortalama bileti düşürür',
    'Boya randevusunda ürün önermemek = hizmet marjının yarısı kayıp',
  ],
  retention_hooks: [
    '4 hafta sonra otomatik "saçlarının bakımı nasıl?" mesajı',
    'Doğum günü %20 indirim → aylık stabil gelir',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%50-60', why: 'Ürün maliyeti düşük, insan emeği yoğun' },
    { metric: 'Ürün satış/hizmet oranı', target: '%15+', why: 'Ürün satışı salonun gizli kâr kaynağı' },
    { metric: 'Tekrar gelme (8 hafta)', target: '%60+', why: 'Boya-kesim döngüsü doğal 6-8 hafta' },
  ],
  playbooks: [
    { trigger: 'Mayıs (düğün sezonu)', action: '"Düğün Paketi" (kesim + boya + bakım + ekstra) — önceden rezervasyon', expected_impact: 'Mayıs-Haziran cirosunda +%30' },
    { trigger: '6 haftadır gelmeyen sadık müşteri', action: 'Otomatik "saçların seni özledi" mesajı + ücretsiz maske', expected_impact: 'Winback oranı %25' },
    { trigger: 'Aralık son hafta', action: 'Yılbaşı party styling paketi', expected_impact: 'Günlük randevu 2x' },
  ],
}

const BARBER: SectorStrategy = {
  seasonal: buildSeasonal({
    4: { demand: 'high', note: 'Bahar — sakal şekillendirme talebi' },
    5: { demand: 'peak', note: 'Düğün/mezuniyet hazırlığı' },
    6: { demand: 'peak', note: 'Yaz kesimi + sakal yoğunluğu' },
    9: { demand: 'high', note: 'Okul/iş başı kesim' },
    12: { demand: 'peak', note: 'Yılbaşı traş talebi' },
  }),
  profit_drivers: [
    'Abonelik (aylık sınırsız kesim) düzenli nakit akışı sağlar',
    'Sakal bakım ürünü satışı kesim üzerine %30 ek kâr',
    'Lüks traş (sıcak havlu + maske) standart fiyatın 2 katı',
  ],
  margin_leaks: [
    'Yoğun saatte düşük bilet (sadece kesim) = fırsat maliyeti',
  ],
  retention_hooks: [
    '3 haftalık döngü otomatik hatırlatma',
    'Abonelik modeli → ayrılma oranını yarıya düşürür',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%55-65', why: 'Düşük sarf, yüksek emek' },
    { metric: 'Günlük doluluk', target: '%75+', why: 'Kesim hızlı, slot rotasyonu yoğun olmalı' },
  ],
  playbooks: [
    { trigger: 'Aylık 3+ gelen sadık müşteri', action: 'Sınırsız kesim aboneliği teklif (aylık sabit)', expected_impact: 'CLV 3x, churn %50 azalır' },
    { trigger: 'Boş cumartesi öğle slotu', action: 'Sosyal medyada "son 5 slot" acil duyuru', expected_impact: '3-5 ek randevu' },
  ],
}

const BEAUTY_SALON: SectorStrategy = {
  seasonal: buildSeasonal({
    3: { demand: 'high', note: 'Bahar temizliği — cilt bakımı' },
    4: { demand: 'high', note: 'Düğün hazırlığı' },
    5: { demand: 'peak', note: 'Düğün + mezuniyet zirvesi' },
    6: { demand: 'peak', note: 'Tatil öncesi cilt/tırnak' },
    9: { demand: 'normal', note: 'İş başı cilt bakımı' },
    12: { demand: 'peak', note: 'Yılbaşı hazırlık zirvesi' },
  }),
  profit_drivers: [
    'Manikür + pedikür kombo paketler ayrı ayrı satıştan %20 daha kârlı',
    'Cilt bakım paketi (3 seans) tek seansa göre %35 daha kârlı',
    'Sadık müşteriye ürün satışı (krem, losyon)',
  ],
  margin_leaks: [
    'Kısa süreli promosyon düzenli müşteriyi fiyata alıştırır',
  ],
  retention_hooks: [
    '3 haftada bir manikür hatırlatıcı',
    'Cilt bakım protokolü (aylık 1 seans, 6 ay)',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%50-60', why: 'Emek yoğun, sarf düşük' },
    { metric: 'Paket satış oranı', target: '%40+', why: 'Paket = stabil gelir' },
  ],
  playbooks: [
    { trigger: 'Mayıs düğün sezonu', action: '"Gelin Paketi" (cilt + manikür + pedikür + makyaj)', expected_impact: 'Paket cirosunda +%40' },
    { trigger: 'Tek seans manikür müşterisi', action: '3. ziyaretinde "3+1 paket" teklifi', expected_impact: 'Tekrar gelme %45 artar' },
  ],
}

const PHYSIOTHERAPY: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'high', note: 'Yeni yıl "sağlıklı yaşam" başvuruları' },
    3: { demand: 'high', note: 'Bahar — spor yaralanmaları' },
    5: { demand: 'high', note: 'Yaz sporu hazırlığı' },
    9: { demand: 'high', note: 'Okul/iş başı postür problemleri' },
    11: { demand: 'peak', note: 'Kış öncesi ağrı artışı' },
  }),
  profit_drivers: [
    'Seans paketleri (10-20 seans) düzenli gelir ve yüksek tamamlanma',
    'Ev ziyareti premium fiyat (standard 2x)',
    'Protokol tamamlayan hastaya "bakım seansı" önerisi (aylık 1)',
  ],
  margin_leaks: [
    'Tek seans müşterisi düşük CLV',
    'Doktor sevkleri olmadan kurumsal anlaşma = düşük doluluk',
  ],
  retention_hooks: [
    'Protokol sonrası aylık bakım programı',
    'Ağrı geri döndüğünde otomatik hatırlatıcı (3 ay sonra)',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%45-55', why: 'Uzman emek yoğun, ekipman orta' },
    { metric: 'Paket tamamlanma oranı', target: '%80+', why: 'Yarıda bırakma CLV\'yi yarıya düşürür' },
  ],
  playbooks: [
    { trigger: 'Eylül (okul başı)', action: 'Postür değerlendirme ücretsiz haftası + 10 seans paket', expected_impact: '15-20 yeni hasta' },
    { trigger: 'Protokol 5. seans tamamlandı', action: 'Devam motivasyon SMS + tamamlama ödülü', expected_impact: 'Tamamlanma +%30' },
  ],
}

const YOGA_PILATES: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'peak', note: 'Yeni yıl kararları — kayıt zirvesi' },
    2: { demand: 'high', note: 'Ocak kayıtlarının devamı' },
    3: { demand: 'high', note: 'Bahar "forma girme" talebi' },
    5: { demand: 'high', note: 'Yaz öncesi hazırlık' },
    7: { demand: 'low', note: 'Tatil dönemi — online ders teklifi' },
    9: { demand: 'peak', note: 'Sezon başı — üyelik yenileme/yeni kayıt zirvesi' },
    10: { demand: 'high', note: 'Sonbahar — düzenli devam' },
  }),
  profit_drivers: [
    'Aylık üyelik (abonelik) → stabil gelir, düşük personel yükü',
    'Grup dersi (10+ kişi) birebire göre saat başına çok daha kârlı',
    'Özel ders (birebir) premium fiyat',
    'Workshop/retreat yüksek marjlı ek gelir',
  ],
  margin_leaks: [
    'Boş ders saatleri doğrudan kayıp (personel ödeniyor)',
    'Üyelik iptal oranı (churn) %10+ ise ciro daralır',
  ],
  retention_hooks: [
    'Haftada 1 gelmeyene 10 gün içinde motivasyon mesajı',
    'İptal etmek isteyene 1 ay ücretsiz dondurma seçeneği',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%40-55', why: 'Kira ve eğitmen maliyeti sabit' },
    { metric: 'Ortalama üyelik süresi', target: '6+ ay', why: 'Kazanım maliyetini karşılamak için' },
    { metric: 'Ders doluluk oranı', target: '%65+', why: 'Sabit giderler için' },
  ],
  playbooks: [
    { trigger: 'Ocak (yeni yıl)', action: '"30 gün dene, 1000₺" tanıtım — sonra aylık üyelik', expected_impact: 'Yeni kayıt 2x' },
    { trigger: 'Eylül (sezon başı)', action: 'Üyelik yenileme + arkadaş getir (2. üye %30 indirim)', expected_impact: 'Üye tabanı +%25' },
    { trigger: 'Üye 14 gündür gelmedi', action: 'Otomatik "seni bekliyoruz" mesajı + özel ders teklifi', expected_impact: 'Churn %30 azalır' },
  ],
}

const FITNESS: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'peak', note: 'Yılbaşı kararları — kayıt zirvesi (yılın %30\'u)' },
    2: { demand: 'high', note: 'Ocak kayıtlarının devamı' },
    3: { demand: 'high', note: 'Yaz hazırlığı başlar' },
    4: { demand: 'peak', note: 'Yaz öncesi forma girme zirvesi' },
    5: { demand: 'peak', note: 'Devam ediyor' },
    7: { demand: 'low', note: 'Tatil — önden dondurma teklifi' },
    8: { demand: 'low', note: 'Tatil sonu' },
    9: { demand: 'high', note: 'Sezon başı kayıt dalgası' },
  }),
  profit_drivers: [
    'Yıllık üyelik aylıktan %20 daha kârlı (ön ödeme)',
    'PT (kişisel antrenör) seansı grup üyeliğinden 5x kâr',
    'Suplement/protein satışı %40 marj',
  ],
  margin_leaks: [
    '3 aydır gelmeyen üyeye aktif ücret kesilmiyorsa churn başlar',
    'Dondurma politikası yanlışsa üye kaçar',
  ],
  retention_hooks: [
    'İlk ay "hoşgeldin" PT seansı hediyesi → tamamlama %60 artar',
    '30 gündür gelmeyene otomatik koçluk araması',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%30-45', why: 'Ekipman amortismanı ve kira yüksek' },
    { metric: 'Aylık churn', target: '<%5', why: 'Yeni üye kazanımı pahalı' },
    { metric: 'PT paket satış oranı', target: 'üyelerin %20\'si', why: 'PT primini kaldırıyor' },
  ],
  playbooks: [
    { trigger: 'Ocak kayıt dalgası', action: 'İlk ay ücretsiz PT değerlendirme + yıllık paket indirimi', expected_impact: 'Yıllık dönüşüm +%30' },
    { trigger: 'Üye 3 hafta gelmedi', action: 'Koçluk arama + ücretsiz yenileme seansı', expected_impact: 'Churn %40 azalır' },
  ],
}

const RESTAURANT: SectorStrategy = {
  seasonal: buildSeasonal({
    2: { demand: 'high', note: 'Sevgililer günü — özel menü' },
    5: { demand: 'high', note: 'Anneler günü + düğün yemekleri' },
    6: { demand: 'peak', note: 'Mezuniyet + yaz açık alan' },
    7: { demand: 'peak', note: 'Yaz — turist ve açık alan' },
    8: { demand: 'peak', note: 'Yaz devam' },
    12: { demand: 'peak', note: 'Yılbaşı rezervasyon zirvesi' },
  }),
  profit_drivers: [
    'İçecek satışı (alkol + meşrubat) yemek marjının 2 katı',
    'Rezervasyon + ön sipariş no-show riskini azaltır',
    'Günlük menü (set) maliyeti optimize eder',
  ],
  margin_leaks: [
    'Yemek israfı (firing/iade) doğrudan kâr kaybı',
    'Rezervasyon no-show masayı boşaltır',
    'Yüksek yıldız Google puanı olmadan müşteri kazanımı pahalı',
  ],
  retention_hooks: [
    'Her yemek sonrası Google review rica',
    'Sadık müşteriye doğum günü masa hediyesi',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%15-25', why: 'Gıda maliyeti 30-35%, personel 25%' },
    { metric: 'Masa döngüsü', target: '1.8+/akşam', why: 'Doluluk için kritik' },
    { metric: 'Yıldız ortalaması (Google)', target: '4.5+', why: 'Yeni müşteri kazanımı' },
  ],
  playbooks: [
    { trigger: 'Pazartesi-Salı sakin akşam', action: '"2 kişilik set menü %30" promosyonu', expected_impact: 'Doluluk +%40' },
    { trigger: 'Aralık 3. hafta', action: 'Yılbaşı menüsü early bird rezervasyon', expected_impact: '2-3 kat hızlı dolma' },
  ],
}

const CAFE: SectorStrategy = {
  seasonal: buildSeasonal({
    6: { demand: 'high', note: 'Yaz soğuk içecek zirvesi' },
    7: { demand: 'peak', note: 'Yaz iced coffee + limonata' },
    10: { demand: 'high', note: 'Sonbahar pumpkin spice dönemi' },
    11: { demand: 'high', note: 'Kış sıcak içecek + tatlı' },
    12: { demand: 'peak', note: 'Yılbaşı tatlı + hediye çeki' },
  }),
  profit_drivers: [
    'Kahve + tatlı kombo siparişinde marj çok yüksek (%60+)',
    'Ev yapımı tatlılar dışarıdan alınan ürüne göre 2-3x kâr',
    'Kahve çekirdeği/ekipman satışı (coffee geek müşteri)',
  ],
  margin_leaks: [
    'Gün sonu bayat ürün iadesi',
    'Wi-fi oturan ama az tüketen müşteri döngüsü',
  ],
  retention_hooks: [
    'Sadakat kartı (10 kahve + 1 ücretsiz)',
    'Sabah saatlerinde çalışanlara "go" paketi',
  ],
  kpi_targets: [
    { metric: 'Kâr marjı', target: '%25-40', why: 'İçecek maliyeti düşük, gıda yüksek' },
    { metric: 'Ortalama sepet', target: 'kahve+tatlı kombo', why: 'Tek kahve bileti yetmez' },
  ],
  playbooks: [
    { trigger: 'Pazartesi-Çarşamba sabah sakin', action: '"Kahve + croissant" kombo %20 indirim 08-10', expected_impact: 'Sabah siparişi 2x' },
    { trigger: 'Yaz başı (Mayıs)', action: 'Iced coffee launch + ücretsiz deneme', expected_impact: 'Yaz menü satışı %30 yüksek' },
  ],
}

// ── Özet (diğer) sektörler — seasonal + 2-3 playbook ──

const PSYCHOLOGIST: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'high', note: 'Yılbaşı kararları + kış depresyonu talebi' },
    3: { demand: 'high', note: 'Bahar — kaygı ve tükenmişlik' },
    9: { demand: 'high', note: 'Okul/iş başı adaptasyon' },
    11: { demand: 'high', note: 'Sonbahar duygu durum talebi' },
  }),
  profit_drivers: ['Haftada düzenli seans paketi (8-12 seans)', 'Online seans → ev ziyareti maliyeti yok'],
  margin_leaks: ['İlk seans ücretsiz ama dönüşmeyen danışan'],
  retention_hooks: ['Seans arası 3 günlük ödev hatırlatma'],
  kpi_targets: [{ metric: 'Kâr marjı', target: '%60-70', why: 'Ofis + uzman maliyeti net' }],
  playbooks: [
    { trigger: 'Ocak', action: '"Yeni yıl — yeni bir sen" 4 seans paketi', expected_impact: 'Ocak cirosunda +%20' },
    { trigger: 'Online seans seçeneği', action: 'Fiziksel gelmeyen danışanlara online öner', expected_impact: 'İptal %30 azalır' },
  ],
}

const LAWYER: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'normal', note: 'Yeni yıl sözleşme yenilemeleri' },
    9: { demand: 'high', note: 'İş yılı başı hukuki danışmanlık' },
  }),
  profit_drivers: ['Retainer (aylık sabit danışmanlık) düzenli gelir', 'Uzmanlaştığı alan premium fiyat'],
  margin_leaks: ['Tahsil edilemeyen alacaklar (asistan takip zayıf)'],
  retention_hooks: ['Müvekkil dosyası tamamlandıktan sonra yıllık check-in'],
  kpi_targets: [{ metric: 'Tahsilat oranı', target: '%90+', why: 'Hizmet verilip parası alınmayan dosya kârsız' }],
  playbooks: [
    { trigger: 'Müvekkil dosyası kapandı', action: '6 ay sonra "yeni bir ihtiyaç var mı?" check-in', expected_impact: 'Tekrar müvekkil %30' },
  ],
}

const VETERINARY: SectorStrategy = {
  seasonal: buildSeasonal({
    3: { demand: 'high', note: 'Bahar aşıları ve parazit' },
    4: { demand: 'peak', note: 'Aşı + kısırlaştırma zirvesi' },
    6: { demand: 'high', note: 'Yaz — seyahat öncesi kontrol' },
    10: { demand: 'high', note: 'Sonbahar aşı yenilemesi' },
  }),
  profit_drivers: ['Aşı programı yıllık stabil gelir', 'Mama ve aksesuar satışı', 'Cerrahi yüksek marj'],
  margin_leaks: ['Acil gelen evcil hayvan takibi zayıfsa sonraki aşılar kaybolur'],
  retention_hooks: ['Aşı tarihi 14 gün önce otomatik hatırlatıcı', 'Yıllık check-up paketi'],
  kpi_targets: [{ metric: 'Aşı dönüş oranı', target: '%80+', why: 'Yıllık stabil gelir için' }],
  playbooks: [
    { trigger: 'Yavru muayene', action: 'Yıllık aşı paketi teklifi (tek seferde ödeme %10 indirim)', expected_impact: 'Tamamlanma %85' },
  ],
}

const AUTO_SERVICE: SectorStrategy = {
  seasonal: buildSeasonal({
    3: { demand: 'high', note: 'Kış lastiği değişimi' },
    11: { demand: 'peak', note: 'Kış lastiği + bakım zirvesi' },
    5: { demand: 'high', note: 'Yaz seyahat öncesi bakım' },
    6: { demand: 'high', note: 'Klima bakımı talebi artar' },
  }),
  profit_drivers: ['Periyodik bakım paketi', 'Yedek parça satışı', 'Kış/yaz lastik depolama'],
  margin_leaks: ['Bakım hatırlatıcısı olmadan müşteri rakibe kayar'],
  retention_hooks: ['KM bazlı otomatik bakım hatırlatıcı'],
  kpi_targets: [{ metric: 'Bakım dönüş oranı', target: '%60+', why: 'Düzenli müşteri kâr üretir' }],
  playbooks: [
    { trigger: 'Kasım ilk hafta', action: 'Kış lastiği erken rezervasyon %15 indirim', expected_impact: 'Ocak yoğunluğu %30 azalır, ciro stabil' },
  ],
}

const CAR_WASH: SectorStrategy = {
  seasonal: buildSeasonal({
    3: { demand: 'high', note: 'Bahar temizliği' },
    4: { demand: 'peak', note: 'Yağmur sonrası zirve' },
    10: { demand: 'high', note: 'Sonbahar iç-dış detaylı yıkama' },
    11: { demand: 'high', note: 'Kış öncesi seramik kaplama' },
  }),
  profit_drivers: ['Abonelik (aylık sınırsız)', 'Detaylı paket (pasta+cila) standart fiyatın 3x'],
  margin_leaks: ['Yağışlı dönemde müşteri kaybı'],
  retention_hooks: ['Abonelik = düzenli gelir', '2 hafta sonra temizlik hatırlatıcı'],
  kpi_targets: [{ metric: 'Abonelik oranı', target: '%30+', why: 'Sabit gelir için' }],
  playbooks: [
    { trigger: 'Günlük 10+ tek yıkama müşterisi', action: 'Aylık sınırsız yıkama paketi teklifi', expected_impact: 'Aylık abonelik +50 müşteri' },
  ],
}

const DIETITIAN: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'peak', note: 'Yeni yıl kilo kararları — başvuru zirvesi' },
    3: { demand: 'high', note: 'Yaz hazırlığı' },
    4: { demand: 'high', note: 'Bikini hazırlığı' },
    9: { demand: 'high', note: 'Okul/iş başı sağlıklı beslenme' },
  }),
  profit_drivers: ['Takip paketleri (4-12 hafta)', 'Online danışmanlık', 'Toplu danışmanlık (grup programı)'],
  margin_leaks: ['Motivasyonunu kaybeden danışan bırakıp kaybolur'],
  retention_hooks: ['Haftalık check-in mesajı', 'Başarı fotoğrafı paylaşımı ödülü'],
  kpi_targets: [{ metric: 'Paket tamamlama oranı', target: '%70+', why: 'Yarıda bırakma referans kaybı' }],
  playbooks: [
    { trigger: 'Ocak', action: '"30 gün sağlıklı başla" paketi', expected_impact: 'Yeni kayıt %40' },
  ],
}

const TUTORING: SectorStrategy = {
  seasonal: buildSeasonal({
    1: { demand: 'peak', note: 'Üniversite sınavı hazırlık zirvesi' },
    3: { demand: 'peak', note: 'Sınav dönemi' },
    4: { demand: 'peak', note: 'YKS/LGS yoğun' },
    6: { demand: 'low', note: 'Yaz tatili — yaz kampı teklifi' },
    9: { demand: 'high', note: 'Okul başı düzenli dersler' },
    10: { demand: 'high', note: 'İlk sınav dönemi' },
  }),
  profit_drivers: ['Dönemlik paket (3-6 ay)', 'Grup dersi birebir\'den 3-5x kâr'],
  margin_leaks: ['Öğrenci motivasyon kaybı → iptal'],
  retention_hooks: ['Veli ile aylık ilerleme raporu'],
  kpi_targets: [{ metric: 'Dönem tamamlama', target: '%85+', why: 'Veli referansı kritik' }],
  playbooks: [
    { trigger: 'Ağustos sonu', action: 'Kayıt paketi + erken kayıt indirimi', expected_impact: 'Eylül dolulukta +%40' },
  ],
}

const PHOTO_STUDIO: SectorStrategy = {
  seasonal: buildSeasonal({
    4: { demand: 'high', note: 'Mezuniyet' },
    5: { demand: 'peak', note: 'Düğün + mezuniyet zirvesi' },
    6: { demand: 'peak', note: 'Düğün sezonu' },
    9: { demand: 'high', note: 'Sonbahar outdoor çekim' },
    12: { demand: 'high', note: 'Yılbaşı aile çekimi' },
  }),
  profit_drivers: ['Paket satışı (çekim + albüm + baskı)', 'Düğün organizasyonu premium'],
  margin_leaks: ['Teslim gecikmesi → müşteri memnuniyeti düşer'],
  retention_hooks: ['Yıllık "fotoğraflarını tazele" hatırlatıcı'],
  kpi_targets: [{ metric: 'Paket dönüşüm', target: '%60+', why: 'Tek çekim düşük CLV' }],
  playbooks: [
    { trigger: 'Mart', action: 'Düğün sezonu erken rezervasyon %20 indirim', expected_impact: 'Yaz doluluk %80+' },
  ],
}

const SPA_MASSAGE: SectorStrategy = {
  seasonal: buildSeasonal({
    2: { demand: 'high', note: 'Sevgililer günü çift paket' },
    5: { demand: 'high', note: 'Yaz hazırlığı' },
    11: { demand: 'high', note: 'Stres dönemi + kış bakımı' },
    12: { demand: 'peak', note: 'Yılbaşı hediye çeki' },
  }),
  profit_drivers: ['Seans paketleri (5-10)', 'Çift paketleri', 'Hediye çeki satışı'],
  margin_leaks: ['Tek seans müşterisi düşük CLV'],
  retention_hooks: ['Aylık sadakat paketi'],
  kpi_targets: [{ metric: 'Kâr marjı', target: '%50-60', why: 'Emek + yağ/ürün maliyeti' }],
  playbooks: [
    { trigger: 'Kasım-Aralık', action: 'Yılbaşı hediye çeki kampanyası', expected_impact: 'Aralık ciro %30 ek' },
  ],
}

const TATTOO_PIERCING: SectorStrategy = {
  seasonal: buildSeasonal({
    10: { demand: 'high', note: 'Sonbahar — güneş etkisi az, iyileşme ideal' },
    11: { demand: 'peak', note: 'Kış — uzun kollu giysi avantajı' },
    3: { demand: 'high', note: 'Bahar — yaz öncesi son dönem' },
  }),
  profit_drivers: ['Büyük projeler (multi-session)', 'Sanatçı özgün tasarım premium'],
  margin_leaks: ['Portfolyo zayıfsa düşük ortalama bilet'],
  retention_hooks: ['İyileşme kontrol 2 hafta sonra randevu'],
  kpi_targets: [{ metric: 'Ortalama bilet', target: '2000₺+', why: 'Malzeme/sağlık standardı' }],
  playbooks: [
    { trigger: 'Yeni müşteri consultasyon', action: 'Paket fiyat (2+ seans) teklif', expected_impact: 'Multi-session dönüşüm %40' },
  ],
}

const OTHER: SectorStrategy = {
  seasonal: STANDARD_SEASONAL,
  profit_drivers: ['Sadık müşteri paketleri', 'Ek hizmet / ürün satışı'],
  margin_leaks: ['Takip zayıflığı → müşteri kaybı'],
  retention_hooks: ['Randevu sonrası memnuniyet mesajı + tekrar daveti'],
  kpi_targets: [{ metric: 'Doluluk', target: '%65+', why: 'Sabit gider amortismanı' }],
  playbooks: [
    { trigger: 'Boş saatler', action: 'Sadık müşteriye kısa notice indirim', expected_impact: '+5 randevu/hafta' },
  ],
}

export const SECTOR_STRATEGY: Record<SectorType, SectorStrategy> = {
  medical_aesthetic: MEDICAL_AESTHETIC,
  dental_clinic: DENTAL_CLINIC,
  hair_salon: HAIR_SALON,
  barber: BARBER,
  beauty_salon: BEAUTY_SALON,
  physiotherapy: PHYSIOTHERAPY,
  yoga_pilates: YOGA_PILATES,
  fitness: FITNESS,
  restaurant: RESTAURANT,
  cafe: CAFE,
  psychologist: PSYCHOLOGIST,
  lawyer: LAWYER,
  veterinary: VETERINARY,
  auto_service: AUTO_SERVICE,
  car_wash: CAR_WASH,
  dietitian: DIETITIAN,
  tutoring: TUTORING,
  photo_studio: PHOTO_STUDIO,
  spa_massage: SPA_MASSAGE,
  tattoo_piercing: TATTOO_PIERCING,
  other: OTHER,
}

// ── Yardımcılar ──

const MONTH_LABELS_TR = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
]

export const DEMAND_LABELS_TR: Record<SeasonalDemand, string> = {
  low: 'düşük',
  normal: 'normal',
  high: 'yüksek',
  peak: 'zirve',
}

export interface SeasonalContextSummary {
  currentMonth: number
  currentLabel: string
  currentDemand: SeasonalDemand
  currentNote: string
  upcoming: { month: number; label: string; demand: SeasonalDemand; note: string }[]
}

/**
 * Şu anki ay + gelecek 2 ay için mevsimsel bağlamı döner.
 * AI prompt'a enjekte etmek ve İş Zekası sayfasında göstermek için.
 */
export function getCurrentSeasonalContext(
  sector: SectorType,
  now: Date = new Date(),
): SeasonalContextSummary {
  const strategy = SECTOR_STRATEGY[sector] ?? OTHER
  const currentMonth = now.getMonth() + 1
  const current = strategy.seasonal[currentMonth - 1]
  const upcoming: SeasonalContextSummary['upcoming'] = []
  for (let i = 1; i <= 2; i++) {
    const m = ((currentMonth - 1 + i) % 12) + 1
    const s = strategy.seasonal[m - 1]
    upcoming.push({
      month: m,
      label: MONTH_LABELS_TR[m - 1],
      demand: s.demand,
      note: s.note,
    })
  }
  return {
    currentMonth,
    currentLabel: MONTH_LABELS_TR[currentMonth - 1],
    currentDemand: current.demand,
    currentNote: current.note,
    upcoming,
  }
}

/**
 * System prompt'a enjekte etmek için compact sektör stratejisi metni (~400-500 token).
 */
export function getSectorStrategyForPrompt(sector: SectorType): string {
  const strategy = SECTOR_STRATEGY[sector] ?? OTHER
  const ctx = getCurrentSeasonalContext(sector)

  const lines: string[] = []
  lines.push(`## Sektörel Stratejik Bağlam`)
  lines.push(`Şu an: ${ctx.currentLabel} — talep ${DEMAND_LABELS_TR[ctx.currentDemand]}. ${ctx.currentNote}`)
  const upcomingLine = ctx.upcoming.map(u => `${u.label}: ${DEMAND_LABELS_TR[u.demand]} (${u.note})`).join(' · ')
  lines.push(`Önümüzdeki 2 ay — ${upcomingLine}`)

  if (strategy.profit_drivers.length > 0) {
    lines.push(`\nKâr sürücüleri:`)
    strategy.profit_drivers.slice(0, 3).forEach(p => lines.push(`- ${p}`))
  }
  if (strategy.margin_leaks.length > 0) {
    lines.push(`\nMarj kayıpları:`)
    strategy.margin_leaks.slice(0, 2).forEach(p => lines.push(`- ${p}`))
  }
  if (strategy.kpi_targets.length > 0) {
    lines.push(`\nHedef KPI'lar:`)
    strategy.kpi_targets.slice(0, 3).forEach(k =>
      lines.push(`- ${k.metric}: ${k.target} (${k.why})`),
    )
  }
  if (strategy.playbooks.length > 0) {
    lines.push(`\nSeni ilgilendirebilecek playbook'lar:`)
    strategy.playbooks.slice(0, 3).forEach(p =>
      lines.push(`- ${p.trigger} → ${p.action} → ${p.expected_impact}`),
    )
  }

  return lines.join('\n')
}

/** Sektörün bu ay ve önümüzdeki 2 ay içinde peak/high sayılan ayları (chart highlight için). */
export function getHighDemandMonths(sector: SectorType): { month: number; demand: SeasonalDemand }[] {
  const strategy = SECTOR_STRATEGY[sector] ?? OTHER
  return strategy.seasonal
    .filter(s => s.demand === 'peak' || s.demand === 'high')
    .map(s => ({ month: s.month, demand: s.demand }))
}
