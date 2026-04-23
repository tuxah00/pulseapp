import type { SectorPlugin } from '../types'

export const fitnessPlugin: SectorPlugin = {
  id: 'fitness',
  name: 'Fitness & Spor Salonu Eklentisi',
  description: 'Spor salonlarına özel üyelik yönetimi, sınıf programı ve performans takibi',
  version: '1.0.0',
  sectors: ['fitness', 'yoga_pilates'],

  actions: [
    {
      key: 'membership-renew',
      label: 'Üyelik Yenile',
      iconName: 'RefreshCw',
      description: 'Seçili üyenin üyeliğini yeniler',
      context: 'customer',
    },
    {
      key: 'attendance-check',
      label: 'Yoklama Al',
      iconName: 'CheckSquare',
      description: 'Sınıf yoklaması',
      context: 'appointment',
    },
    {
      key: 'progress-report',
      label: 'İlerleme Raporu',
      iconName: 'TrendingUp',
      description: 'Üyenin aylık devam ve ilerleme raporu',
      context: 'customer',
      requiredPlan: 'standard',
    },
  ],

  templates: [
    {
      key: 'membership-agreement',
      name: 'Üyelik Sözleşmesi',
      description: 'Spor salonu üyelik sözleşmesi',
      category: 'consent_form',
      content: `# Üyelik Sözleşmesi

**Üye:** {{customerName}}
**Tarih:** {{date}}
**Tesis:** {{businessName}}

## Üyelik Bilgileri
- **Üyelik Tipi:** {{membershipType}}
- **Başlangıç:** {{startDate}}
- **Bitiş:** {{endDate}}
- **Ücret:** {{price}}

## Kurallar
1. Spor yaparken havlu kullanmak zorunludur
2. Ekipmanları kullandıktan sonra silmek zorunludur
3. Uygun spor kıyafeti giyilmelidir
4. Soyunma dolapları günlük kullanım içindir
5. Kişisel antrenör dışında başkalarına program yazılamaz
6. Tesise giriş kartı kişiye özeldir, devredilemez

## Sağlık Beyanı
Herhangi bir sağlık sorununuz varsa antrenörünüze bildiriniz.

**Üye İmza:** _______________
**Tarih:** {{date}}`,
    },
    {
      key: 'fitness-health-form',
      name: 'Sağlık Bilgi Formu',
      description: 'Üye kayıt sağlık durum formu',
      category: 'checklist',
      content: `# Sağlık Bilgi Formu

**Üye:** {{customerName}}
**Tarih:** {{date}}

## Genel Sağlık
- [ ] Kalp rahatsızlığı
- [ ] Yüksek tansiyon
- [ ] Diyabet
- [ ] Astım
- [ ] Eklem/kas problemi
- [ ] Bel/boyun fıtığı
- [ ] Epilepsi
- [ ] Gebelik

## Alerji
- _____________________

## Kullandığınız İlaçlar
- _____________________

## Doktor Bilgisi
- Doktor: _____________________
- Telefon: _____________________

**Beyan:** Yukarıdaki bilgilerin doğruluğunu onaylıyorum.

**İmza:** _______________`,
    },
  ],

  aiCapabilities: [
    {
      key: 'class-optimization',
      name: 'Ders Programı Optimizasyonu',
      description: 'Devam oranlarına göre optimal ders saati önerisi',
      endpoint: '/api/ai/weekly-insights',
      requiredPlan: 'pro',
    },
  ],

  widgets: [
    {
      key: 'membership-stats',
      name: 'Üyelik İstatistikleri',
      description: 'Aktif/pasif üye sayıları ve yenileme oranı',
      component: 'MembershipStatsWidget',
      size: 'small',
    },
    {
      key: 'class-attendance',
      name: 'Sınıf Doluluk',
      description: 'Bugünkü sınıfların doluluk durumu',
      component: 'ClassAttendanceWidget',
      size: 'medium',
    },
  ],

  customerLabel: 'Üyeler',
  customerLabelSingular: 'Üye',
  appointmentLabel: 'Ders',
}
