import type { SectorPlugin } from '../types'

export const aestheticPlugin: SectorPlugin = {
  id: 'aesthetic',
  name: 'Medikal Estetik Eklentisi',
  description: 'Medikal estetik kliniklerine özel tedavi takibi, onam formu ve AI analiz araçları',
  version: '1.0.0',
  sectors: ['medical_aesthetic'],

  sidebarItems: [
    { key: 'photo-analysis', name: 'Fotoğraf Analizi', href: '/dashboard/protocols', iconName: 'ScanFace', requiredPlan: 'pro' },
  ],

  actions: [
    {
      key: 'generate-consent',
      label: 'Onam Formu Oluştur',
      iconName: 'FileSignature',
      description: 'Seçili hizmet için onam formu oluşturur',
      context: 'appointment',
    },
    {
      key: 'post-care-instructions',
      label: 'Bakım Talimatları',
      iconName: 'Heart',
      description: 'Tedavi sonrası bakım talimatları oluşturur',
      context: 'session',
    },
    {
      key: 'photo-compare',
      label: 'Fotoğraf Karşılaştır',
      iconName: 'ScanFace',
      description: 'Before/after fotoğraflarını AI ile karşılaştırır',
      context: 'session',
      endpoint: '/api/ai/before-after',
      requiredPlan: 'pro',
    },
  ],

  templates: [
    {
      key: 'botox-consent',
      name: 'Botulinum Toksin Onam Formu',
      description: 'Botox/Dysport uygulama öncesi hasta onam formu',
      category: 'consent_form',
      content: `# Botulinum Toksin Uygulama Onam Formu

**Hasta:** {{customerName}}
**Tarih:** {{date}}
**İşletme:** {{businessName}}

## Bilgilendirme

Botulinum toksin (Botox/Dysport) uygulaması hakkında aşağıdaki hususlarda bilgilendirildim:

### Uygulama Alanı
- {{treatmentArea}}

### Olası Yan Etkiler
- Uygulama bölgesinde geçici kızarıklık, şişlik veya morarma
- Baş ağrısı (nadir)
- Göz kapağı düşüklüğü (çok nadir, geçici)
- Asimetri (düzeltilebilir)

### Kontrendikasyonlar
- Gebelik ve emzirme döneminde uygulanmaz
- Nöromüsküler hastalıklar
- Uygulama bölgesinde aktif enfeksiyon
- Bilinen alerji

### Sonrası Dikkat Edilecekler
- 4 saat boyunca uygulama bölgesine dokunmayın
- 24 saat boyunca yoğun egzersiz yapmayın
- 2 hafta boyunca sauna ve hamama girmeyin

## Onay

Yukarıdaki bilgileri okudum, anladım ve uygulamayı kabul ediyorum.

**Hasta İmza:** _______________
**Tarih:** {{date}}`,
    },
    {
      key: 'filler-consent',
      name: 'Dolgu Uygulama Onam Formu',
      description: 'Hyalüronik asit dolgu uygulama onam formu',
      category: 'consent_form',
      content: `# Dermal Dolgu Uygulama Onam Formu

**Hasta:** {{customerName}}
**Tarih:** {{date}}
**İşletme:** {{businessName}}

## Bilgilendirme

Hyalüronik asit dolgu uygulaması hakkında bilgilendirildim:

### Uygulama Alanı
- {{treatmentArea}}

### Olası Yan Etkiler
- Şişlik ve morarma (1-2 hafta)
- Hassasiyet
- Asimetri (düzeltilebilir)
- Nodül oluşumu (nadir)
- Vasküler komplikasyon (çok nadir)

### Sonrası Dikkat Edilecekler
- 24 saat makyaj yapmayın
- 1 hafta yoğun egzersiz ve saunadan kaçının
- Buz uygulayarak şişliği azaltabilirsiniz

## Onay

Yukarıdaki bilgileri okudum, anladım ve uygulamayı kabul ediyorum.

**Hasta İmza:** _______________
**Tarih:** {{date}}`,
    },
    {
      key: 'laser-post-care',
      name: 'Lazer Sonrası Bakım Talimatları',
      description: 'Lazer tedavisi sonrası hasta bakım talimatları',
      category: 'post_care',
      content: `# Lazer Tedavisi Sonrası Bakım Talimatları

**Hasta:** {{customerName}}
**Tedavi:** {{treatmentName}}
**Tarih:** {{date}}

## İlk 24 Saat
- Tedavi bölgesine buz uygulayın (10 dk açık, 10 dk kapalı)
- Sıcak su ile yıkanmayın
- Makyaj yapmayın
- Güneşten kaçının

## İlk Hafta
- SPF 50+ güneş kremi kullanın (2 saatte bir yenileyin)
- Nemlendirici kullanın
- Soyulan cildi koparmayın
- Sauna, havuz ve denize girmeyin

## Dikkat Edilecekler
- Kızarıklık ve hafif şişlik normaldir (2-3 gün sürebilir)
- Kabuklanma olabilir, doğal dökülmesini bekleyin
- Şiddetli ağrı veya ateş olursa kliniğe başvurun

## Sonraki Seans
- Bir sonraki seans tarihi: {{nextSessionDate}}
- Seans aralığı: {{intervalDays}} gün`,
    },
  ],

  aiCapabilities: [
    {
      key: 'skin-analysis',
      name: 'Cilt Analizi',
      description: 'AI destekli cilt dokusü, pigmentasyon ve kırışıklık değerlendirmesi',
      endpoint: '/api/ai/photo-analysis',
      requiredPlan: 'pro',
    },
    {
      key: 'before-after-compare',
      name: 'Öncesi/Sonrası Karşılaştırma',
      description: 'İki fotoğraf arasında AI destekli iyileşme analizi',
      endpoint: '/api/ai/before-after',
      requiredPlan: 'pro',
    },
  ],

  widgets: [
    {
      key: 'treatment-progress',
      name: 'Tedavi İlerleme Özeti',
      description: 'Aktif tedavi protokollerinin ilerleme durumu',
      component: 'TreatmentProgressWidget',
      size: 'medium',
    },
  ],

  customerLabel: 'Hastalar',
  customerLabelSingular: 'Hasta',
  appointmentLabel: 'Seans',
}
