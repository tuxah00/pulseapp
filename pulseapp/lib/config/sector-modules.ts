import type { SectorType, PlanType } from '@/types'

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
  { key: 'appointments', name: 'Randevular', href: '/dashboard/appointments', iconName: 'Calendar' },
  { key: 'customers', name: 'Müşteriler', href: '/dashboard/customers', iconName: 'Users' },
]

// Management items shown for every sector
const MANAGEMENT_ITEMS: SidebarItem[] = [
  { key: 'services', name: 'Hizmetler', href: '/dashboard/settings/services', iconName: 'Scissors' },
  { key: 'staff', name: 'Personeller', href: '/dashboard/settings/staff', iconName: 'UserPlus' },
  { key: 'messages', name: 'Mesajlar', href: '/dashboard/messages', iconName: 'MessageSquare' },
  { key: 'analytics', name: 'Analitik', href: '/dashboard/analytics', iconName: 'BarChart3' },
  { key: 'shifts', name: 'Vardiya', href: '/dashboard/settings/vardiye', iconName: 'CalendarDays' },
]

// Sector-specific items
const SECTOR_ITEMS: Partial<Record<SectorType, SidebarItem[]>> = {
  hair_salon: [
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/stoklar', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  barber: [
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/stoklar', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  beauty_salon: [
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/stoklar', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  dental_clinic: [
    { key: 'records', name: 'Hasta Dosyaları', href: '/dashboard/records?type=patient_file', iconName: 'FolderOpen' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  medical_aesthetic: [
    { key: 'records', name: 'Hasta Dosyaları', href: '/dashboard/records?type=patient_file', iconName: 'FolderOpen' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  physiotherapy: [
    { key: 'records', name: 'Hasta Dosyaları', href: '/dashboard/records?type=patient_file', iconName: 'FolderOpen' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  psychologist: [
    { key: 'records', name: 'Danışan Dosyaları', href: '/dashboard/records?type=client_file', iconName: 'FolderOpen' },
  ],
  lawyer: [
    { key: 'records', name: 'Müvekkil Dosyaları', href: '/dashboard/records?type=case_file', iconName: 'Briefcase' },
  ],
  auto_service: [
    { key: 'vehicles', name: 'Araç Kayıtları', href: '/dashboard/records?type=vehicle', iconName: 'Car' },
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/stoklar', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  car_wash: [
    { key: 'vehicles', name: 'Araç Kayıtları', href: '/dashboard/records?type=vehicle', iconName: 'Car' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  veterinary: [
    { key: 'records', name: 'Hasta Dosyaları', href: '/dashboard/records?type=pet', iconName: 'PawPrint' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  dietitian: [
    { key: 'records', name: 'Diyet Programları', href: '/dashboard/records?type=diet_plan', iconName: 'ClipboardList' },
  ],
  fitness: [
    { key: 'memberships', name: 'Üyelikler', href: '/dashboard/memberships', iconName: 'CreditCard' },
    { key: 'classes', name: 'Sınıf Programı', href: '/dashboard/classes', iconName: 'CalendarDays' },
    { key: 'attendance', name: 'Devam Takibi', href: '/dashboard/classes/attendance', iconName: 'CheckSquare' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  yoga_pilates: [
    { key: 'memberships', name: 'Üyelikler', href: '/dashboard/memberships', iconName: 'CreditCard' },
    { key: 'classes', name: 'Sınıf Programı', href: '/dashboard/classes', iconName: 'CalendarDays' },
    { key: 'attendance', name: 'Devam Takibi', href: '/dashboard/classes/attendance', iconName: 'CheckSquare' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  spa_massage: [
    { key: 'memberships', name: 'Üyelikler & Paketler', href: '/dashboard/memberships', iconName: 'CreditCard' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  tutoring: [
    { key: 'records', name: 'Öğrenci Bilgileri', href: '/dashboard/records?type=student', iconName: 'BookOpen' },
  ],
  photo_studio: [
    { key: 'portfolio', name: 'Portfolyo', href: '/dashboard/portfolio', iconName: 'Image' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  tattoo_piercing: [
    { key: 'portfolio', name: 'Portfolyo', href: '/dashboard/portfolio', iconName: 'Image' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  restaurant: [
    { key: 'reservations', name: 'Rezervasyonlar', href: '/dashboard/reservations', iconName: 'CalendarCheck' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  cafe: [
    { key: 'reservations', name: 'Rezervasyonlar', href: '/dashboard/reservations', iconName: 'CalendarCheck' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
  other: [
    { key: 'inventory', name: 'Stoklar', href: '/dashboard/stoklar', iconName: 'Package' },
    { key: 'reviews', name: 'Yorumlar', href: '/dashboard/reviews', iconName: 'Star' },
  ],
}

export function getSidebarSections(sector: SectorType, _plan: PlanType): SidebarSection[] {
  const sectorItems = SECTOR_ITEMS[sector] ?? []

  // Sectors that replace appointments with reservations
  const excludeAppointments: SectorType[] = ['restaurant', 'cafe']
  const filteredBase = excludeAppointments.includes(sector)
    ? BASE_ITEMS.filter(item => item.key !== 'appointments')
    : BASE_ITEMS

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
    sectors: ['hair_salon', 'barber', 'beauty_salon', 'spa_massage', 'tattoo_piercing'],
  },
  {
    label: 'Sağlık & Klinik',
    sectors: ['dental_clinic', 'medical_aesthetic', 'physiotherapy', 'veterinary', 'psychologist', 'dietitian'],
  },
  {
    label: 'Hizmet & Ticaret',
    sectors: ['lawyer', 'auto_service', 'car_wash', 'tutoring', 'photo_studio'],
  },
  {
    label: 'Yeme & İçme',
    sectors: ['restaurant', 'cafe'],
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
