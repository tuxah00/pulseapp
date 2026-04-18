import type { SectorPlugin } from '../types'

export const dentalPlugin: SectorPlugin = {
  id: 'dental',
  name: 'Diş Kliniği Eklentisi',
  description: 'Diş kliniklerine özel hasta takibi, panoramik analiz ve tedavi planlama araçları',
  version: '1.0.0',
  sectors: ['dental_clinic'],

  actions: [
    {
      key: 'dental-chart-note',
      label: 'Diş Notu Ekle',
      iconName: 'Stethoscope',
      description: 'Seçili dişe not ve tedavi bilgisi ekler',
      context: 'customer',
    },
    {
      key: 'panoramic-analysis',
      label: 'Panoramik Analiz',
      iconName: 'ScanFace',
      description: 'Panoramik röntgeni AI ile analiz eder',
      context: 'session',
      endpoint: '/api/ai/photo-analysis',
      requiredPlan: 'pro',
    },
  ],

  templates: [
    {
      key: 'dental-consent',
      name: 'Diş Tedavisi Onam Formu',
      description: 'Genel diş tedavisi için hasta onam formu',
      category: 'consent_form',
      content: `# Diş Tedavisi Onam Formu

**Hasta:** {{customerName}}
**Tarih:** {{date}}
**Klinik:** {{businessName}}

## Planlanan Tedavi
- {{treatmentName}}
- Bölge: {{treatmentArea}}

## Bilgilendirme

Aşağıdaki durumlar hakkında bilgilendirildim:

### Olası Riskler
- Anestezi sonrası geçici uyuşukluk
- Tedavi bölgesinde hassasiyet ve ağrı
- Geçici çene ağrısı
- Kanal tedavisi gerekliliği (öngörülemeyen durumda)

### Tedavi Sonrası
- 2 saat boyunca yeme-içme yapmayın (anestezili işlemlerde)
- Sıcak yiyecek ve içeceklerden kaçının
- Reçete edilen ilaçları düzenli kullanın
- Şiddetli ağrı veya şişlik durumunda kliniğe başvurun

## Onay

Yukarıdaki bilgileri okudum ve tedaviyi kabul ediyorum.

**Hasta İmza:** _______________
**Tarih:** {{date}}`,
    },
    {
      key: 'implant-consent',
      name: 'İmplant Onam Formu',
      description: 'Dental implant uygulama onam formu',
      category: 'consent_form',
      content: `# Dental İmplant Uygulama Onam Formu

**Hasta:** {{customerName}}
**Tarih:** {{date}}
**Klinik:** {{businessName}}

## Planlanan İşlem
- İmplant sayısı: {{implantCount}}
- Bölge: {{treatmentArea}}

## Bilgilendirme

### İşlem Hakkında
- Cerrahi müdahale ile çene kemiğine titanyum vida yerleştirilecektir
- İyileşme süresi: 3-6 ay (kemiğe bağlı)
- Üst yapı (kron) ayrı seansta uygulanacaktır

### Olası Komplikasyonlar
- Şişlik ve morarma (1 hafta)
- Enfeksiyon riski
- Sinir hasarı (alt çenede uyuşukluk — nadir)
- İmplant tutmama (reddetme)
- Sinüs perforasyonu (üst çenede)

### Sonrası Bakım
- 24 saat buz uygulayın
- Yumuşak gıdalarla beslenin
- Antibiyotik ve ağrı kesiciyi düzenli kullanın
- 1 hafta sigara içmeyin
- Kontrol randevularına mutlaka gelin

## Onay

Bilgilendirme yapıldı, riskleri anladım, tedaviyi kabul ediyorum.

**Hasta İmza:** _______________
**Tarih:** {{date}}`,
    },
    {
      key: 'dental-post-care',
      name: 'Tedavi Sonrası Talimatlar',
      description: 'Genel diş tedavisi sonrası bakım talimatları',
      category: 'post_care',
      content: `# Diş Tedavisi Sonrası Bakım Talimatları

**Hasta:** {{customerName}}
**Tedavi:** {{treatmentName}}
**Tarih:** {{date}}

## Anestezi Sonrası
- Uyuşukluk 2-4 saat sürebilir
- Bu sürede yeme-içme yapmayın
- Dudak ve yanağınızı ısırmamaya dikkat edin

## Ağrı Yönetimi
- Reçete edilen ağrı kesiciyi kullanın
- İlk gün buz uygulayın (15 dk açık, 15 dk kapalı)

## Beslenme
- İlk gün yumuşak, ılık gıdalar tercih edin
- Tedavi yapılan tarafla çiğnemekten kaçının

## Ne Zaman Arayın
- Şiddetli ve artan ağrı
- Kontrolsüz kanama
- Ateş
- Aşırı şişlik

**Kontrol randevusu:** {{nextAppointmentDate}}`,
    },
  ],

  aiCapabilities: [
    {
      key: 'panoramic-xray-analysis',
      name: 'Panoramik Röntgen Analizi',
      description: 'AI destekli panoramik röntgen değerlendirmesi',
      endpoint: '/api/ai/photo-analysis',
      requiredPlan: 'pro',
    },
  ],

  widgets: [
    {
      key: 'dental-daily-summary',
      name: 'Günlük Klinik Özeti',
      description: 'Bugünkü randevular ve yapılacak tedaviler',
      component: 'DentalDailySummary',
      size: 'medium',
    },
  ],

  customerLabel: 'Hastalar',
  customerLabelSingular: 'Hasta',
  appointmentLabel: 'Randevu',
}
