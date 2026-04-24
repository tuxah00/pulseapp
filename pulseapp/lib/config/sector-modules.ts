import type { SectorType, PlanType, BusinessSettings, StaffPermissions } from '@/types'

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
  { key: 'assistant-actions', name: 'Asistan Aksiyonları', href: '/dashboard/assistant-actions', iconName: 'Inbox' },
  { key: 'automations', name: 'Otomasyonlar', href: '/dashboard/automations', iconName: 'Zap' },
  { key: 'analytics', name: 'Gelir-Gider', href: '/dashboard/analytics', iconName: 'BarChart3' },
  { key: 'invoices', name: 'Faturalar', href: '/dashboard/invoices', iconName: 'Receipt' },
  { key: 'shifts', name: 'Vardiya', href: '/dashboard/shifts', iconName: 'CalendarDays' },
  { key: 'workflows', name: 'Otomatik Mesajlar', href: '/dashboard/workflows', iconName: 'GitBranch' },
  { key: 'commissions', name: 'Prim & Komisyon', href: '/dashboard/commissions', iconName: 'BadgePercent' },
  { key: 'audit', name: 'Denetim', href: '/dashboard/audit', iconName: 'ShieldCheck' },
  { key: 'kvkk', name: 'KVKK', href: '/dashboard/kvkk', iconName: 'Lock' },
]

// Pilot modunda gizlenecek menü öğeleri
// (PayTR/Twilio/Paraşüt aboneliklerine bağımlı; pilot için ya kafa karıştırıcı ya işlevsiz)
const PILOT_HIDDEN_KEYS = new Set(['campaigns'])

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
    { key: 'protocols', name: 'Tedavi Protokolleri', href: '/dashboard/protocols', iconName: 'Stethoscope' },
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

  const pilotMode = settings?.pilot_mode === true
  const managementItems = pilotMode
    ? MANAGEMENT_ITEMS.filter(item => !PILOT_HIDDEN_KEYS.has(item.key))
    : MANAGEMENT_ITEMS.filter(item => item.key !== 'automations') // pilot dışında otomasyon paneli gizli (cron çalışıyor)

  return [
    { label: 'Ana', items: filteredBase },
    ...(sectorItems.length > 0 ? [{ label: 'Sektör', items: sectorItems }] : []),
    { label: 'Yönetim', items: managementItems },
  ]
}

// ---------------------------------------------------------------------------
// Sector module helpers
// ---------------------------------------------------------------------------

/**
 * Some sidebar keys are aliases that resolve to the same page/permission.
 * e.g. `vehicles` (auto_service / car_wash) → /dashboard/records → permission 'records'
 *      `attendance` → /dashboard/classes/attendance → permission 'classes'
 */
const SECTOR_KEY_ALIASES: Record<string, string[]> = {
  records: ['records', 'vehicles'],
  classes: ['classes', 'attendance'],
}

/**
 * Returns true if the given sector's sidebar includes the module identified
 * by `moduleKey`. Only checks sector-specific items (not base / management),
 * so base modules (appointments, customers, …) always return false here —
 * those are universally accessible.
 */
export function sectorHasModule(sector: SectorType, moduleKey: string): boolean {
  const sectorItems = SECTOR_ITEMS[sector] ?? []
  const keys = SECTOR_KEY_ALIASES[moduleKey] ?? [moduleKey]
  return sectorItems.some(i => keys.includes(i.key))
}

// Sidebar item key → StaffPermissions key (null = no direct permission key)
const SIDEBAR_KEY_TO_PERM: Record<string, keyof StaffPermissions | null> = {
  // BASE_ITEMS
  dashboard: 'dashboard',
  appointments: 'appointments',
  customers: 'customers',
  waitlist: 'waitlist',
  // MANAGEMENT_ITEMS
  pos: 'pos',
  campaigns: 'campaigns',
  services: 'services',
  staff: 'staff',
  messages: 'messages',
  insights: 'insights',
  'assistant-actions': 'assistant_actions',
  automations: null, // ayrı yetki yok — sidebar item'ı pilot mode flag'iyle filtrelenir
  analytics: 'analytics',
  invoices: 'invoices',
  shifts: 'shifts',
  workflows: 'workflows',
  commissions: 'commissions',
  audit: 'audit',
  kvkk: 'kvkk',
  // SECTOR_ITEMS
  packages: 'packages',
  records: 'records',
  vehicles: 'records',
  'follow-ups': 'follow_ups',
  reviews: 'reviews',
  protocols: 'protocols',
  rewards: 'rewards',
  inventory: 'inventory',
  memberships: 'memberships',
  classes: 'classes',
  attendance: 'classes',
  orders: 'orders',
  reservations: 'reservations',
  portfolio: 'portfolio',
}

/**
 * Returns the StaffPermissions keys that are relevant for the given sector.
 * The settings/staff permission editor uses this to hide toggles for modules
 * that don't exist in the current sector (e.g. no "Sınıflar" for a clinic).
 */
export function getSectorPermissionKeys(
  sector: SectorType,
  plan: PlanType = 'starter',
  settings?: BusinessSettings | null
): (keyof StaffPermissions)[] {
  const sections = getSidebarSections(sector, plan, settings)
  const allItems = sections.flatMap(s => s.items)

  const permKeys = allItems
    .map(item => SIDEBAR_KEY_TO_PERM[item.key])
    .filter((k): k is keyof StaffPermissions => k != null)

  // 'settings' doesn't appear as a sidebar item but is always a valid permission
  return [...new Set(['settings' as keyof StaffPermissions, ...permKeys])]
}

// ---------------------------------------------------------------------------
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
