import type { SectorType, PlanType, BusinessSettings } from '@/types'

export interface SidebarItem {
  key: string
  name: string
  href: string
  iconName: string
}

export interface SidebarSection {
  label: string
  items: SidebarItem[]
}

// Base items shown for every sector
const BASE_ITEMS: SidebarItem[] = [
  { key: 'dashboard', name: 'Genel Bakış', href: '/dashboard', iconName: 'LayoutDashboard' },
  { key: 'appointments', name: 'Randevular', href: '/dashboard/appointments', iconName: 'CalendarCheck' },
  { key: 'customers', name: 'Müşteriler', href: '/dashboard/customers', iconName: 'Users' },
  { key: 'waitlist', name: 'Bekleme Listesi', href: '/dashboard/waitlist', iconName: 'ClipboardList' },
]

// Management items shown for every sector
const MANAGEMENT_ITEMS: SidebarItem[] = [
  { key: 'pos', name: 'Kasa', href: '/dashboard/pos', iconName: 'Banknote' },
  { key: 'campaigns', name: 'Kampanyalar', href: '/dashboard/campaigns', iconName: 'Megaphone' },
  { key: 'services', name: 'Hizmetler', href: '/dashboard/services', iconName: 'ListChecks' },
  { key: 'staff', name: 'Personeller', href: '/dashboard/staff', iconName: 'UserCog' },
  { key: 'messages', name: 'Mesajlar', href: '/dashboard/messages', iconName: 'MessageSquare' },
  { key: 'insights', name: 'İş Zekası', href: '/dashboard/insights', iconName: 'TrendingUp' },
  { key: 'asistan-aksiyonlari', name: 'Asistan Aksiyonları', href: '/dashboard/asistan-aksiyonlari', iconName: 'Inbox' },
  { key: 'analytics', name: 'Gelir-Gider', href: '/dashboard/analytics', iconName: 'BarChart3' },
  { key: 'invoices', name: 'Faturalar', href: '/dashboard/invoices', iconName: 'Receipt' },
  { key: 'shifts', name: 'Vardiya', href: '/dashboard/shifts', iconName: 'CalendarDays' },
  { key: 'workflows', name: 'Otomatik Mesajlar', href: '/dashboard/workflows', iconName: 'GitBranch' },
  { key: 'commissions', name: 'Prim & Komisyon', href: '/dashboard/commissions', iconName: 'BadgePercent' },
  { key: 'audit', name: 'Denetim', href: '/dashboard/audit', iconName: 'ShieldCheck' },
  { key: 'kvkk', name: 'KVKK', href: '/dashboard/kvkk', iconName: 'Lock' },
]

// Sector-specific items
const SECTOR_ITEMS: Partial<Record<SectorType, SidebarItem[]>> = {
  hair_salon: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/inventory', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  barber: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/inventory', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  beauty_salon: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/inventory', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  dental_clinic: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Hasta Dosyalar\u0131', href: '/dashboard/records?type=patient_file', iconName: 'FolderOpen' },
    { key: 'follow-ups', name: 'Takipler', href: '/dashboard/follow-ups', iconName: 'CalendarClock' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  medical_aesthetic: [
    { key: 'protocols', name: 'Tedavi Planları', href: '/dashboard/protocols', iconName: 'Stethoscope' },
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Hasta Dosyalar\u0131', href: '/dashboard/records?type=patient_file', iconName: 'FolderOpen' },
    { key: 'follow-ups', name: 'Takipler', href: '/dashboard/follow-ups', iconName: 'CalendarClock' },
    { key: 'rewards', name: 'Ödüller', href: '/dashboard/rewards', iconName: 'Gift' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  physiotherapy: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Hasta Dosyalar\u0131', href: '/dashboard/records?type=patient_file', iconName: 'FolderOpen' },
    { key: 'follow-ups', name: 'Takipler', href: '/dashboard/follow-ups', iconName: 'CalendarClock' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  psychologist: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Dan\u0131\u015fan Dosyalar\u0131', href: '/dashboard/records?type=client_file', iconName: 'FolderOpen' },
    { key: 'follow-ups', name: 'Takipler', href: '/dashboard/follow-ups', iconName: 'CalendarClock' },
  ],
  lawyer: [
    { key: 'records', name: 'Müvekkil Dosyaları', href: '/dashboard/records?type=case_file', iconName: 'Briefcase' },
  ],
  auto_service: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'vehicles', name: 'Araç Kayıtları', href: '/dashboard/records?type=vehicle', iconName: 'Car' },
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/inventory', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  car_wash: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'vehicles', name: 'Araç Kayıtları', href: '/dashboard/records?type=vehicle', iconName: 'Car' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  veterinary: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Hasta Dosyalar\u0131', href: '/dashboard/records?type=pet', iconName: 'PawPrint' },
    { key: 'follow-ups', name: 'Takipler', href: '/dashboard/follow-ups', iconName: 'CalendarClock' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  dietitian: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Diyet Programlar\u0131', href: '/dashboard/records?type=diet_plan', iconName: 'ClipboardList' },
    { key: 'follow-ups', name: 'Takipler', href: '/dashboard/follow-ups', iconName: 'CalendarClock' },
  ],
  fitness: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'memberships', name: 'Üyelikler', href: '/dashboard/memberships', iconName: 'CreditCard' },
    { key: 'classes', name: 'Sınıf Programı', href: '/dashboard/classes', iconName: 'CalendarDays' },
    { key: 'attendance', name: 'Devam Takibi', href: '/dashboard/classes/attendance', iconName: 'CheckSquare' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  yoga_pilates: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'memberships', name: 'Üyelikler', href: '/dashboard/memberships', iconName: 'CreditCard' },
    { key: 'classes', name: 'Sınıf Programı', href: '/dashboard/classes', iconName: 'CalendarDays' },
    { key: 'attendance', name: 'Devam Takibi', href: '/dashboard/classes/attendance', iconName: 'CheckSquare' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  spa_massage: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'memberships', name: 'Üyelikler', href: '/dashboard/memberships', iconName: 'CreditCard' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  tutoring: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'records', name: 'Öğrenci Bilgileri', href: '/dashboard/records?type=student', iconName: 'BookOpen' },
  ],
  photo_studio: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'portfolio', name: 'Çalışma Galerisi', href: '/dashboard/portfolio', iconName: 'Image' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  tattoo_piercing: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'portfolio', name: 'Çalışma Galerisi', href: '/dashboard/portfolio', iconName: 'Image' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  restaurant: [
    { key: 'orders', name: 'Siparişler', href: '/dashboard/orders', iconName: 'ClipboardList' },
    { key: 'reservations', name: 'Rezervasyonlar', href: '/dashboard/reservations', iconName: 'CalendarCheck' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  cafe: [
    { key: 'orders', name: 'Siparişler', href: '/dashboard/orders', iconName: 'ClipboardList' },
    { key: 'reservations', name: 'Rezervasyonlar', href: '/dashboard/reservations', iconName: 'CalendarCheck' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  other: [
    { key: 'packages', name: 'Paket & Seans', href: '/dashboard/packages', iconName: 'Layers' },
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/inventory', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
}

const CUSTOMER_LABELS: Partial<Record<SectorType, string>> = {
  psychologist: 'Danışanlar',
  dental_clinic: 'Hastalar',
  medical_aesthetic: 'Hastalar',
  physiotherapy: 'Hastalar',
  veterinary: 'Hastalar',
  lawyer: 'Müvekkiller',
  fitness: 'Üyeler',
  yoga_pilates: 'Üyeler',
  tutoring: 'Öğrenciler',
}

export function getCustomerLabel(sector: SectorType): string {
  return CUSTOMER_LABELS[sector] ?? 'Müşteriler'
}

const CUSTOMER_LABELS_SINGULAR: Record<string, string> = {
  dental_clinic: 'Hasta',
  medical_aesthetic: 'Hasta',
  physiotherapy: 'Hasta',
  psychologist: 'Danışan',
  veterinary: 'Hasta',
  lawyer: 'Müvekkil',
  fitness: 'Üye',
  yoga_pilates: 'Üye',
  tutoring: 'Öğrenci',
}

export function getCustomerLabelSingular(sector?: string): string {
  return CUSTOMER_LABELS_SINGULAR[sector || ''] || 'Müşteri'
}

export function getSidebarSections(
  sector: SectorType,
  _plan: PlanType,
  settings?: BusinessSettings | null
): SidebarSection[] {
  const rawSectorItems = SECTOR_ITEMS[sector] ?? []

  // Ödüller sekmesi her zaman sidebar'da görünür; aktifleştirme rewards sayfasından yapılır
  const sectorItems = rawSectorItems

  // Sectors that replace appointments with reservations
  const excludeAppointments: SectorType[] = ['restaurant', 'cafe']
  const customerLabel = CUSTOMER_LABELS[sector] ?? 'Müşteriler'

  const filteredBase = BASE_ITEMS.map(item =>
    item.key === 'customers' ? { ...item, name: customerLabel } : item
  ).filter(item => excludeAppointments.includes(sector) ? item.key !== 'appointments' : true)

  return [
    { label: 'Ana', items: filteredBase },
    ...(sectorItems.length > 0 ? [{ label: 'Sektör', items: sectorItems }] : []),
    { label: 'Yönetim', items: MANAGEMENT_ITEMS },
  ]
}

// Sector category groupings for onboarding form
export const SECTOR_GROUPS: { label: string; sectors: SectorType[] }[] = [
  {
    label: 'Güzellik & Bakım',
    sectors: ['hair_salon', 'barber', 'beauty_salon', 'spa_massage'],
  },
  {
    label: 'Sağlık & Klinik',
    sectors: ['dental_clinic', 'medical_aesthetic', 'physiotherapy', 'veterinary', 'psychologist', 'dietitian'],
  },
  {
    label: 'Hizmet & Ticaret',
    sectors: ['auto_service', 'car_wash', 'tutoring'],
  },
  {
    label: 'Spor & Yaşam',
    sectors: ['fitness', 'yoga_pilates'],
  },
  {
    label: 'Diğer',
    sectors: ['other'],
  },
]
