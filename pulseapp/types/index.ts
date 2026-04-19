// ============================================
// PulseApp — TypeScript Tip Tanımları
// Veritabanı şemasıyla birebir uyumlu
// ============================================

// ── Enum Tipleri ──

export type SectorType =
  | 'hair_salon' | 'barber' | 'beauty_salon'
  | 'dental_clinic' | 'psychologist' | 'lawyer'
  | 'restaurant' | 'cafe' | 'auto_service'
  | 'veterinary' | 'physiotherapy' | 'dietitian'
  | 'tutoring' | 'photo_studio' | 'car_wash'
  | 'spa_massage' | 'medical_aesthetic' | 'fitness'
  | 'yoga_pilates' | 'tattoo_piercing' | 'other'

export type PlanType = 'starter' | 'standard' | 'pro'

export type SubscriptionStatusType =
  | 'trial' | 'active' | 'past_due' | 'cancelled' | 'expired'

export type StaffRole = 'owner' | 'manager' | 'staff'

export interface StaffPermissions {
  dashboard: boolean
  appointments: boolean
  customers: boolean
  analytics: boolean
  messages: boolean
  reviews: boolean
  services: boolean
  staff: boolean
  shifts: boolean
  settings: boolean
  reservations?: boolean
  classes?: boolean
  memberships?: boolean
  packages?: boolean
  records?: boolean
  portfolio?: boolean
  inventory?: boolean
  orders?: boolean
  invoices?: boolean
  pos?: boolean
  protocols?: boolean
  rewards?: boolean
  campaigns?: boolean
  workflows?: boolean
  commissions?: boolean
}

// Granüler "Düzenle" yetkileri — her modül için yazma iznini ayrı yönetir
export type StaffWritePermissions = Partial<Record<keyof StaffPermissions, boolean>>

// "Düzenle" desteği olan modüller (UI'de edit toggle gösterilir)
export const WRITABLE_PERMISSION_KEYS: ReadonlyArray<keyof StaffPermissions> = [
  'appointments', 'customers', 'services', 'staff', 'shifts',
  'messages', 'reservations', 'classes', 'memberships', 'packages',
  'records', 'portfolio', 'inventory', 'orders', 'invoices', 'pos',
  'protocols', 'rewards', 'campaigns', 'workflows', 'commissions', 'settings',
] as const

// Sadece görüntüleme modülleri (UI'de edit sütunu "—" gösterir)
export const READ_ONLY_PERMISSION_KEYS: ReadonlyArray<keyof StaffPermissions> = [
  'dashboard', 'analytics', 'reviews',
] as const

export const DEFAULT_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  owner: {
    dashboard: true, appointments: true, customers: true, analytics: true,
    messages: true, reviews: true, services: true, staff: true, shifts: true,
    settings: true, reservations: true, classes: true, memberships: true,
    packages: true, records: true, portfolio: true, inventory: true, orders: true, invoices: true, pos: true,
    protocols: true, rewards: true, campaigns: true, workflows: true, commissions: true,
  },
  manager: {
    dashboard: true, appointments: true, customers: true, analytics: true,
    messages: true, reviews: true, services: true, staff: false, shifts: true,
    settings: false, reservations: true, classes: true, memberships: true,
    packages: true, records: true, portfolio: true, inventory: true, orders: true, invoices: true, pos: true,
    protocols: true, rewards: true, campaigns: true, workflows: true, commissions: false,
  },
  // Personel varsayılanı: temel operasyon (randevu + müşteri) açık.
  // Diğer tüm modüller açıkça `false` — sidebar `permissions[key] !== false`
  // kontrolünü `undefined` durumunda "izinli" sayıyor, bu yüzden açık false gerekiyor.
  staff: {
    dashboard: true, appointments: true, customers: true, analytics: false,
    messages: false, reviews: false, services: false, staff: false, shifts: false,
    settings: false, reservations: false, classes: false, memberships: false,
    packages: false, records: false, portfolio: false, inventory: false,
    orders: false, invoices: false, pos: false,
    protocols: false, rewards: false, campaigns: false, workflows: false, commissions: false,
  },
}

export const DEFAULT_WRITE_PERMISSIONS: Record<StaffRole, StaffWritePermissions> = {
  owner: Object.fromEntries(WRITABLE_PERMISSION_KEYS.map(k => [k, true])) as StaffWritePermissions,
  manager: Object.fromEntries(
    WRITABLE_PERMISSION_KEYS
      .filter(k => k !== 'staff' && k !== 'settings')
      .map(k => [k, true])
  ) as StaffWritePermissions,
  // Personel varsayılanı: sadece temel operasyon (randevu + müşteri). Diğer modüller view-only veya kapalı.
  staff: { appointments: true, customers: true },
}

export function getEffectivePermissions(role: StaffRole, customPermissions?: StaffPermissions | null): StaffPermissions {
  if (role === 'owner') return DEFAULT_PERMISSIONS.owner
  if (customPermissions) return customPermissions
  return DEFAULT_PERMISSIONS[role]
}

export function getEffectiveWritePermissions(
  role: StaffRole,
  customWrite?: StaffWritePermissions | null
): StaffWritePermissions {
  if (role === 'owner') return DEFAULT_WRITE_PERMISSIONS.owner
  if (customWrite) return customWrite
  return DEFAULT_WRITE_PERMISSIONS[role]
}

// Helper: Sayfa görüntüleme kontrolü (null = yükleniyor, permissive)
export function canView(
  perms: StaffPermissions | null | undefined,
  key: keyof StaffPermissions
): boolean {
  if (!perms) return true
  return perms[key] !== false
}

// Helper: Sayfa içinde yazma kontrolü
// - view yoksa edit olamaz
// - READ_ONLY modüllerde edit her zaman false
// - writePermissions NULL ise yeni modül için default KAPALI
export function canEdit(
  viewPerms: StaffPermissions | null | undefined,
  writePerms: StaffWritePermissions | null | undefined,
  key: keyof StaffPermissions
): boolean {
  if (!viewPerms) return true
  if (viewPerms[key] === false) return false
  if ((READ_ONLY_PERMISSION_KEYS as readonly string[]).includes(key)) return false
  if (!writePerms) return false
  return writePerms[key] === true
}

export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentSource = 'web' | 'manual' | 'phone'

export type CustomerSegment = 'new' | 'regular' | 'vip' | 'risk' | 'lost'

export type MessageDirection = 'inbound' | 'outbound'
export type MessageChannel = 'sms' | 'web' | 'whatsapp'
export type MessageType = 'text' | 'template' | 'ai_generated' | 'system'
export type AiClassification =
  | 'appointment' | 'question' | 'complaint' | 'cancellation' | 'greeting' | 'other'

export type ReviewStatus = 'pending' | 'responded' | 'escalated'
export type NotificationType = 'appointment' | 'review' | 'payment' | 'customer' | 'system' | 'stock_alert' | 'ai_brief' | 'ai_alert'

export type InvoiceStatus = 'pending' | 'paid' | 'partial' | 'overdue' | 'cancelled'
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'online'
export type StockMovementType = 'in' | 'out' | 'adjustment' | 'appointment' | 'order'
export type TransactionType = 'sale' | 'refund' | 'package_sale'
export type POSPaymentStatus = 'pending' | 'paid' | 'partial' | 'refunded'
export type POSSessionStatus = 'open' | 'closed'

// ── Fatura Kalemleri ──
export interface InvoiceItem {
  service_name: string
  quantity: number
  unit_price: number
  total: number
  product_id?: string
  package_id?: string
  type?: 'service' | 'product' | 'package'
}

// ── Fatura Ödeme Tipleri ──
export type InvoicePaymentType = 'standard' | 'installment' | 'deposit'
export type InstallmentFrequency = 'weekly' | 'biweekly' | 'monthly'
export type PaymentRecordType = 'payment' | 'deposit' | 'installment' | 'refund'

// ── Fatura Ödeme Kaydı ──
export interface InvoicePayment {
  id: string
  business_id: string
  invoice_id: string
  amount: number
  method: PaymentMethod
  payment_type: PaymentRecordType
  installment_number: number | null
  notes: string | null
  staff_id: string | null
  staff_name: string | null
  created_at: string
}

// ── Fatura ──
export interface Invoice {
  id: string
  business_id: string
  customer_id: string | null
  appointment_id: string | null
  invoice_number: string
  items: InvoiceItem[]
  subtotal: number
  tax_rate: number
  tax_amount: number
  total: number
  paid_amount: number
  status: InvoiceStatus
  payment_method: PaymentMethod | null
  payment_type: InvoicePaymentType
  installment_count: number | null
  installment_frequency: InstallmentFrequency | null
  pos_transaction_id: string | null
  staff_id: string | null
  staff_name: string | null
  paid_at: string | null
  due_date: string | null
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
  // İndirim
  discount_amount: number
  discount_type: 'percentage' | 'fixed' | null
  discount_description: string | null
  // Müşteri vergi bilgileri (snapshot)
  customer_tax_id: string | null
  customer_tax_office: string | null
  customer_company_name: string | null
  // e-Fatura (Paraşüt)
  efatura_id?: string | null
  efatura_status?: string | null
  efatura_pdf_url?: string | null
  // JOINs
  customers?: { name: string; phone: string }
  // Virtual (loaded separately)
  payments?: InvoicePayment[]
}

// ── POS / Kasa ──

export interface POSPayment {
  method: PaymentMethod
  amount: number
}

export interface POSItem {
  id: string
  name: string
  type: 'service' | 'product' | 'package'
  quantity: number
  unit_price: number
  total: number
  product_id?: string
  service_id?: string
  package_id?: string
  sessions_total?: number
}

export interface POSTransaction {
  id: string
  business_id: string
  invoice_id: string | null
  appointment_id: string | null
  customer_id: string | null
  staff_id: string | null
  transaction_type: TransactionType
  items: POSItem[]
  subtotal: number
  discount_amount: number
  discount_type: 'percentage' | 'fixed' | null
  tax_amount: number
  total: number
  payments: POSPayment[]
  payment_status: POSPaymentStatus
  receipt_number: string | null
  notes: string | null
  created_at: string
  updated_at: string
  // JOINs
  customers?: { name: string; phone: string } | null
  staff_members?: { name: string } | null
}

export interface POSSession {
  id: string
  business_id: string
  staff_id: string
  opened_at: string
  closed_at: string | null
  opening_cash: number
  total_cash: number
  total_card: number
  total_transfer: number
  total_sales: number
  total_refunds: number
  expected_cash: number
  actual_cash: number | null
  difference: number | null
  notes: string | null
  status: POSSessionStatus
  created_at: string
  // JOINs
  staff_members?: { name: string } | null
}

// ── Gider ──
export interface Expense {
  id: string
  business_id: string
  category: string
  description: string | null
  amount: number
  expense_date: string
  is_recurring: boolean
  recurring_period: string | null
  custom_interval_days: number | null
  created_at: string
}

export interface Income {
  id: string
  business_id: string
  category: string
  description: string | null
  amount: number
  income_date: string
  is_recurring: boolean
  recurring_period: string | null
  custom_interval_days: number | null
  created_at: string
}

// ── Stok Hareketi ──
export interface StockMovement {
  id: string
  business_id: string
  product_id: string
  quantity: number
  type: StockMovementType
  reference_id: string | null
  notes: string | null
  staff_id: string | null
  created_at: string
  // JOINs
  staff_members?: { name: string }
}

// ── Tedarikçi ──
export interface Supplier {
  id: string
  business_id: string
  name: string
  phone: string | null
  email: string | null
  notes: string | null
  created_at: string
}


// ── Çalışma Saati Tipi ──

export interface DayHours {
  open: string   // "09:00"
  close: string  // "18:00"
}

export interface WorkingHours {
  mon: DayHours | null
  tue: DayHours | null
  wed: DayHours | null
  thu: DayHours | null
  fri: DayHours | null
  sat: DayHours | null
  sun: DayHours | null
}


// ── İşletme Ayarları ──

export interface ShiftDefinition {
  name: string
  start: string
  end: string
}

export type ConfirmationStatus = 'none' | 'waiting' | 'confirmed_by_customer' | 'declined' | 'no_response'

// ── Kampanya ──
export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'completed' | 'cancelled'
export type CampaignChannel = 'auto' | 'sms' | 'whatsapp'
export type CampaignRecipientStatus = 'pending' | 'sent' | 'failed' | 'skipped'

export interface CampaignSegmentFilter {
  segments?: CustomerSegment[]
  lastVisitDaysMin?: number
  lastVisitDaysMax?: number
  birthdayMonth?: number
  minTotalVisits?: number
  minTotalRevenue?: number
  createdDaysAgoMax?: number
}

export interface CampaignStats {
  total_recipients: number
  sent: number
  errors: number
}

export interface Campaign {
  id: string
  business_id: string
  name: string
  description: string | null
  segment_filter: CampaignSegmentFilter
  message_template: string
  channel: CampaignChannel
  scheduled_at: string | null
  expires_at: string | null
  max_recipients: number | null
  status: CampaignStatus
  stats: CampaignStats
  created_by_staff_id: string | null
  created_at: string
  updated_at: string
}

export interface CampaignRecipient {
  id: string
  campaign_id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  status: CampaignRecipientStatus
  sent_at: string | null
  error_message: string | null
  created_at: string
}

export interface BusinessSettings {
  reminder_24h: boolean
  reminder_2h: boolean
  auto_review_request: boolean
  review_request_delay_minutes: number
  winback_days: number
  ai_auto_reply: boolean
  language: string
  reservation_duration_minutes: number
  shift_definitions?: ShiftDefinition[]
  birthday_sms_enabled: boolean
  birthday_sms_template: string
  birthday_sms_hour: number
  logo_url?: string | null
  whatsapp_enabled?: boolean
  whatsapp_mode?: 'sandbox' | 'production'
  default_channel?: 'auto' | 'sms' | 'whatsapp'
  // Randevu onay & no-show
  confirmation_sms_enabled?: boolean
  no_show_auto_score?: boolean
  max_no_shows?: number
  // Periyodik kontrol hatırlatıcı
  periodic_reminder_enabled?: boolean
  periodic_reminder_advance_days?: number
  // Akıllı boşluk doldurma
  gap_fill_enabled?: boolean
  gap_fill_lookback_months?: number
  // Sadakat puan sistemi
  loyalty_enabled?: boolean
  points_per_currency?: number
  visit_bonus_points?: number
  auto_reward_threshold?: number
  redemption_rate?: number  // kaç puan = 1₺ indirim (varsayılan: 10)
  // Ödüller sistemi aç/kapat (varsayılan: true)
  rewards_enabled?: boolean
  // AI asistan tercihleri (Faz 10)
  ai_preferences?: AIPreferences
  ai_memory?: AIMemory
  ai_permissions?: AIPermissions
}

export type AIAssistantTone = 'samimi' | 'formal' | 'kisa'

export interface AIPreferences {
  tone?: AIAssistantTone
  auto_brief_enabled?: boolean
  brief_time?: string           // 'HH:mm' işletme yerel saati
  default_reminder_hours?: number
  custom_instructions?: string  // serbest metin (max ~1000 char)
}

/**
 * AI Asistan granular yetkileri — her kategori için ayrı okuma/yazma toggle'ı.
 * Yetki kontrolü: bir tool çalışırken hem bu yetki (`ai_permissions`) hem
 * onaylayan kullanıcının `StaffPermissions`'ı TRUE olmalı (kesişim kuralı).
 */
export type AIPermissionCategory =
  | 'appointments_read' | 'appointments_write'
  | 'customers_read' | 'customers_write'
  | 'services_read' | 'services_write'
  | 'staff_read' | 'staff_write'
  | 'shifts_read' | 'shifts_write'
  | 'messages_read' | 'messages_write'
  | 'campaigns_read' | 'campaigns_write'
  | 'workflows_read' | 'workflows_write'
  | 'analytics_read'
  | 'invoices_read' | 'invoices_write'
  | 'pos_write'
  | 'expenses_write'
  | 'settings_read' | 'settings_write'
  | 'audit_read'

export type AIPermissions = Partial<Record<AIPermissionCategory, boolean>>

/**
 * AI yetki kategorisi → StaffPermissions alanı eşlemesi.
 * Onay veren kullanıcının bu StaffPermissions alanı TRUE değilse tool çalışmaz.
 */
export const AI_PERMISSION_TO_STAFF: Record<AIPermissionCategory, keyof StaffPermissions> = {
  appointments_read: 'appointments',
  appointments_write: 'appointments',
  customers_read: 'customers',
  customers_write: 'customers',
  services_read: 'services',
  services_write: 'services',
  staff_read: 'staff',
  staff_write: 'staff',
  shifts_read: 'shifts',
  shifts_write: 'shifts',
  messages_read: 'messages',
  messages_write: 'messages',
  campaigns_read: 'campaigns',
  campaigns_write: 'campaigns',
  workflows_read: 'workflows',
  workflows_write: 'workflows',
  analytics_read: 'analytics',
  invoices_read: 'invoices',
  invoices_write: 'invoices',
  pos_write: 'pos',
  expenses_write: 'analytics',
  settings_read: 'settings',
  settings_write: 'settings',
  audit_read: 'settings',
}

/** Varsayılan AI yetkileri: tüm okumalar açık, yazmalar kapalı. */
export const DEFAULT_AI_PERMISSIONS: AIPermissions = {
  appointments_read: true,
  customers_read: true,
  services_read: true,
  staff_read: true,
  shifts_read: true,
  messages_read: true,
  campaigns_read: true,
  workflows_read: true,
  analytics_read: true,
  invoices_read: true,
  settings_read: true,
  audit_read: true,
  // Yazma izinleri varsayılan olarak kapalı; işletme sahibi elle açar
  appointments_write: false,
  customers_write: false,
  services_write: false,
  staff_write: false,
  shifts_write: false,
  messages_write: false,
  campaigns_write: false,
  workflows_write: false,
  invoices_write: false,
  pos_write: false,
  expenses_write: false,
  settings_write: false,
}

export interface AIMemory {
  frequent_customers?: string[]
  common_services?: string[]
  learned_patterns?: Record<string, unknown>
}


// ── Tablo Tipleri ──

export interface Business {
  id: string
  name: string
  sector: SectorType
  phone: string | null
  email: string | null
  address: string | null
  city: string | null
  district: string | null
  subscription_plan: PlanType
  subscription_status: SubscriptionStatusType
  trial_ends_at: string | null
  working_hours: WorkingHours
  settings: BusinessSettings
  google_place_id: string | null
  google_maps_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface TutorialProgress {
  enabled?: boolean
  setup_completed_at?: string | null
  seen_pages?: string[]
  dismissed_at?: string | null
}

export interface StaffMember {
  id: string
  business_id: string
  user_id: string | null
  name: string
  role: StaffRole
  phone: string | null
  email: string | null
  avatar_url: string | null
  working_hours: WorkingHours | null
  permissions: StaffPermissions | null
  write_permissions?: StaffWritePermissions | null
  tutorial_progress: TutorialProgress | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Service {
  id: string
  business_id: string
  name: string
  description: string | null
  duration_minutes: number
  price: number | null
  sort_order: number
  recommended_interval_days: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Customer {
  id: string
  business_id: string
  name: string
  phone: string
  email: string | null
  birthday: string | null
  notes: string | null
  segment: CustomerSegment
  total_visits: number
  total_revenue: number
  total_no_shows: number
  no_show_score: number
  last_visit_at: string | null
  preferred_channel?: 'sms' | 'whatsapp' | 'auto' | null
  // Vergi bilgileri
  tax_id: string | null
  tax_id_type: 'vkn' | 'tckn' | null
  tax_office: string | null
  company_name: string | null
  preferences: Record<string, unknown>
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Appointment {
  id: string
  business_id: string
  customer_id: string
  staff_id: string | null
  service_id: string | null
  appointment_date: string
  start_time: string
  end_time: string
  status: AppointmentStatus
  source: AppointmentSource
  reminder_24h_sent: boolean
  reminder_2h_sent: boolean
  review_requested: boolean
  notes: string | null
  cancellation_reason: string | null
  recurrence_group_id: string | null
  recurrence_pattern: Record<string, unknown> | null
  manage_token: string | null
  token_expires_at: string | null
  confirmation_status: ConfirmationStatus
  confirmation_sent_at: string | null
  deleted_at?: string | null
  room_id?: string | null
  created_at: string
  updated_at: string
  // JOIN'lerden gelen opsiyonel alanlar
  customer?: Customer
  staff?: StaffMember
  service?: Service
}

export interface Message {
  id: string
  business_id: string
  customer_id: string | null
  direction: MessageDirection
  channel: MessageChannel
  message_type: MessageType
  content: string
  twilio_sid: string | null
  twilio_status: string | null
  meta_message_id: string | null
  ai_classification: AiClassification | null
  ai_confidence: number | null
  appointment_id: string | null
  staff_id?: string | null
  staff_name?: string | null
  created_at: string
  // JOIN
  customer?: Customer
}

export interface Review {
  id: string
  business_id: string
  customer_id: string | null
  appointment_id: string | null
  rating: number
  comment: string | null
  ai_response_draft: string | null
  actual_response: string | null
  status: ReviewStatus
  google_review_link_sent: boolean
  is_anonymous?: boolean
  created_at: string
  updated_at: string
  // JOIN
  customer?: Customer
}

export interface Subscription {
  id: string
  business_id: string
  plan: PlanType
  status: SubscriptionStatusType
  paytr_merchant_oid: string | null
  paytr_token: string | null
  current_period_start: string | null
  current_period_end: string | null
  amount: number
  currency: string
  billing_name: string | null
  billing_address: string | null
  billing_tax_id: string | null
  created_at: string
  updated_at: string
}

export interface Payment {
  id: string
  business_id: string
  subscription_id: string | null
  amount: number
  currency: string
  status: string
  paytr_merchant_oid: string | null
  paytr_response: Record<string, unknown> | null
  paid_at: string | null
  created_at: string
}

export interface Notification {
  id: string
  business_id: string
  type: NotificationType
  title: string
  body: string | null
  related_id: string | null
  related_type: string | null
  is_read: boolean
  created_at: string
}

export interface MessageTemplate {
  id: string
  business_id: string | null
  name: string
  slug: string
  channel: MessageChannel
  content: string
  is_active: boolean
  created_at: string
}

export interface WaitlistEntry {
  id: string
  business_id: string
  customer_id: string | null
  customer_name: string
  customer_phone: string
  service_id: string | null
  staff_id: string | null
  preferred_date: string | null
  preferred_time_start: string | null
  preferred_time_end: string | null
  notes: string | null
  is_notified: boolean
  is_active: boolean
  auto_book_on_match: boolean
  notification_expires_at: string | null
  created_at: string
  // JOIN
  customer?: Customer
  service?: Service
  staff?: { id: string; name: string }
}

// ── Paket / Seans Sistemi ──

export type PackageStatus = 'active' | 'completed' | 'cancelled' | 'expired'

export interface ServicePackage {
  id: string
  business_id: string
  name: string
  description: string | null
  service_id: string | null
  sessions_total: number
  price: number
  validity_days: number | null
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
  // JOIN
  service?: Service
}

export interface CustomerPackage {
  id: string
  business_id: string
  package_id: string | null
  customer_id: string | null
  customer_name: string
  customer_phone: string | null
  package_name: string
  service_id: string | null
  sessions_total: number
  sessions_used: number
  price_paid: number
  status: PackageStatus
  purchase_date: string
  expiry_date: string | null
  notes: string | null
  staff_id: string | null
  invoice_id: string | null
  created_at: string
  updated_at: string
  // JOINs
  customer?: Customer
  service?: Service
}

export interface PackageUsage {
  id: string
  business_id: string
  customer_package_id: string
  appointment_id: string | null
  used_at: string
  notes: string | null
  staff_id: string | null
}

export type ShiftType = 'regular' | 'off'

export interface Shift {
  id: string
  business_id: string
  staff_id: string
  shift_date: string
  start_time: string | null
  end_time: string | null
  shift_type: ShiftType
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // JOIN
  staff_members?: StaffMember
}

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'served' | 'paid' | 'cancelled'

export interface OrderItem {
  product_id: string
  name: string
  quantity: number
  price: number
}

export interface Order {
  id: string
  business_id: string
  reservation_id: string | null
  customer_name: string | null
  table_number: string | null
  items: OrderItem[]
  total_amount: number
  status: OrderStatus
  notes: string | null
  created_at: string
  updated_at: string
}


// ── Dashboard View Tipleri ──

export interface BusinessStats {
  business_id: string
  total_customers: number
  today_appointments: number
  today_completed: number
  today_no_shows: number
  total_reviews: number
  avg_rating: number | null
  unread_notifications: number
}

export interface TodayAppointment extends Appointment {
  customer_name: string
  customer_phone: string
  service_name: string | null
  duration_minutes: number | null
  staff_name: string | null
}


// ── Yardımcı Tipler ──

export const SECTOR_LABELS: Record<SectorType, string> = {
  hair_salon: 'Kuaför',
  barber: 'Berber',
  beauty_salon: 'Güzellik Salonu',
  dental_clinic: 'Diş Kliniği',
  psychologist: 'Psikolog',
  lawyer: 'Avukat',
  restaurant: 'Restoran',
  cafe: 'Kafe',
  auto_service: 'Oto Servis',
  veterinary: 'Veteriner',
  physiotherapy: 'Fizyoterapi',
  dietitian: 'Diyetisyen & Beslenme Danışmanı',
  tutoring: 'Özel Ders & Kurs Merkezi',
  photo_studio: 'Fotoğraf Stüdyosu',
  car_wash: 'Oto Yıkama & Detaylı Temizlik',
  spa_massage: 'Spa & Masaj Salonu',
  medical_aesthetic: 'Medikal Estetik & Klinik',
  fitness: 'Fitness & Spor Salonu',
  yoga_pilates: 'Yoga & Pilates Stüdyosu',
  tattoo_piercing: 'Dövme & Piercing Salonu',
  other: 'Diğer',
}

export const PLAN_LABELS: Record<PlanType, string> = {
  starter: 'Başlangıç',
  standard: 'Standart',
  pro: 'Asistan Pro',
}

export const PLAN_PRICES: Record<PlanType, number> = {
  starter: 499,
  standard: 999,
  pro: 1999,
}

export const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: 'Bekliyor',
  confirmed: 'Onaylandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  no_show: 'Gelmedi',
}

export const SEGMENT_LABELS: Record<CustomerSegment, string> = {
  new: 'Yeni',
  regular: 'Düzenli',
  vip: 'VIP',
  risk: 'Riskli',
  lost: 'Kayıp',
}


// ── Tedavi Protokolü & Seans Takibi ──

export type ProtocolStatus = 'active' | 'completed' | 'cancelled' | 'paused'
export type SessionStatus = 'planned' | 'completed' | 'cancelled' | 'skipped'

export const PROTOCOL_STATUS_LABELS: Record<ProtocolStatus, string> = {
  active: 'Aktif',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  paused: 'Duraklatıldı',
}

export const SESSION_STATUS_LABELS: Record<SessionStatus, string> = {
  planned: 'Planlandı',
  completed: 'Tamamlandı',
  cancelled: 'İptal',
  skipped: 'Atlandı',
}

export interface TreatmentProtocol {
  id: string
  business_id: string
  customer_id: string
  service_id: string | null
  name: string
  total_sessions: number
  completed_sessions: number
  interval_days: number
  status: ProtocolStatus
  notes: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // JOINs
  customer?: Customer
  service?: Service
  staff?: StaffMember
  sessions?: ProtocolSession[]
}

export interface ProtocolSession {
  id: string
  protocol_id: string
  business_id: string
  session_number: number
  appointment_id: string | null
  status: SessionStatus
  planned_date: string | null
  completed_date: string | null
  notes: string | null
  before_photo_url: string | null
  after_photo_url: string | null
  created_at: string
  // JOINs
  appointment?: Appointment
}


// ── Müşteri Fotoğraf Galerisi ──

export type PhotoType = 'before' | 'after' | 'progress' | 'xray' | 'panoramic'

export const PHOTO_TYPE_LABELS: Record<PhotoType, string> = {
  before: 'Öncesi',
  after: 'Sonrası',
  progress: 'Süreç',
  xray: 'Röntgen',
  panoramic: 'Panoramik',
}

export interface CustomerPhoto {
  id: string
  business_id: string
  customer_id: string
  protocol_id: string | null
  session_id: string | null
  photo_url: string
  photo_type: PhotoType
  tags: string[]
  notes: string | null
  taken_at: string
  uploaded_by: string | null
  created_at: string
  // JOINs
  protocol?: TreatmentProtocol
  session?: ProtocolSession
  staff?: StaffMember
}


// ── Alerji & Kontrendikasyon ──

export type AllergySeverity = 'mild' | 'moderate' | 'severe'
export type ContraindicationRiskLevel = 'low' | 'medium' | 'high'

export const ALLERGY_SEVERITY_LABELS: Record<AllergySeverity, string> = {
  mild: 'Hafif',
  moderate: 'Orta',
  severe: 'Şiddetli',
}

export const RISK_LEVEL_LABELS: Record<ContraindicationRiskLevel, string> = {
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
}

export interface CustomerAllergy {
  id: string
  business_id: string
  customer_id: string
  allergen: string
  severity: AllergySeverity
  reaction: string | null
  notes: string | null
  reported_at: string
  created_by: string | null
  created_at: string
}

export interface ServiceContraindication {
  id: string
  business_id: string
  service_id: string
  allergen: string
  risk_level: ContraindicationRiskLevel
  warning_message: string | null
  created_at: string
  // JOINs
  service?: Service
}


// ── Referans / Tavsiye Sistemi ──

export type ReferralStatus = 'pending' | 'converted' | 'expired' | 'rewarded'
export type RewardType = 'discount_percent' | 'discount_amount' | 'free_service' | 'points' | 'gift'

export const REFERRAL_STATUS_LABELS: Record<ReferralStatus, string> = {
  pending: 'Bekliyor',
  converted: 'Dönüştürüldü',
  expired: 'Süresi Doldu',
  rewarded: 'Ödüllendirildi',
}

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  discount_percent: '% İndirim',
  discount_amount: '₺ İndirim',
  free_service: 'Ücretsiz Hizmet',
  points: 'Puan',
  gift: 'Hediye',
}

export interface Referral {
  id: string
  business_id: string
  referrer_customer_id: string
  referred_customer_id: string | null
  referred_name: string | null
  referred_phone: string | null
  status: ReferralStatus
  reward_type: RewardType | null
  reward_value: number | null
  reward_claimed: boolean
  converted_at: string | null
  expires_at: string | null
  created_at: string
  // JOINs
  referrer?: Customer
  referred?: Customer
}


// ── Takip Kuyruğu ──

export type FollowUpType = 'post_session' | 'next_session_reminder' | 'protocol_completion'
export type FollowUpStatus = 'pending' | 'sent' | 'cancelled'

export const FOLLOW_UP_TYPE_LABELS: Record<FollowUpType, string> = {
  post_session: 'Seans Sonrası Kontrol',
  next_session_reminder: 'Sonraki Seans Hatırlatma',
  protocol_completion: 'Protokol Tamamlama',
}

export interface FollowUpJob {
  id: string
  business_id: string
  appointment_id: string
  customer_id: string
  protocol_id: string | null
  type: FollowUpType
  scheduled_for: string
  status: FollowUpStatus
  message: string | null
  created_at: string
  // JOINs
  customer?: Customer
  appointment?: Appointment
  protocol?: TreatmentProtocol
}


// ── Diş Haritası ──

export type ToothCondition =
  | 'healthy'
  | 'caries'
  | 'filled'
  | 'crown'
  | 'extracted'
  | 'implant'
  | 'root_canal'
  | 'bridge'
  | 'missing'

export const TOOTH_CONDITION_LABELS: Record<ToothCondition, string> = {
  healthy: 'Sağlıklı',
  caries: 'Çürük',
  filled: 'Dolgulu',
  crown: 'Kron',
  extracted: 'Çekilmiş',
  implant: 'İmplant',
  root_canal: 'Kanal Tedavisi',
  bridge: 'Köprü',
  missing: 'Eksik',
}

export const TOOTH_CONDITION_COLORS: Record<ToothCondition, { bg: string; border: string; text: string }> = {
  healthy:    { bg: 'bg-white dark:bg-gray-200',      border: 'border-gray-300 dark:border-gray-400',  text: 'text-gray-700' },
  caries:     { bg: 'bg-yellow-100 dark:bg-yellow-200', border: 'border-yellow-400',                   text: 'text-yellow-800' },
  filled:     { bg: 'bg-blue-100 dark:bg-blue-200',    border: 'border-blue-400',                      text: 'text-blue-800' },
  crown:      { bg: 'bg-cyan-100 dark:bg-cyan-200',    border: 'border-cyan-400',                      text: 'text-cyan-800' },
  extracted:  { bg: 'bg-red-100 dark:bg-red-200',      border: 'border-red-400',                       text: 'text-red-800' },
  implant:    { bg: 'bg-green-100 dark:bg-green-200',  border: 'border-green-400',                     text: 'text-green-800' },
  root_canal: { bg: 'bg-orange-100 dark:bg-orange-200', border: 'border-orange-400',                   text: 'text-orange-800' },
  bridge:     { bg: 'bg-purple-100 dark:bg-purple-200', border: 'border-purple-400',                   text: 'text-purple-800' },
  missing:    { bg: 'bg-gray-200 dark:bg-gray-400',    border: 'border-gray-400',                      text: 'text-gray-600' },
}

export interface ToothRecord {
  id: string
  business_id: string
  customer_id: string
  tooth_number: number
  condition: ToothCondition
  treatment: string | null
  notes: string | null
  treated_at: string | null
  treated_by_staff_id: string | null
  created_at: string
  updated_at: string
  // JOINs
  staff?: { id: string; name: string }
}


// ── Oda (Room) ──

export interface Room {
  id: string
  business_id: string
  name: string
  capacity: number
  color: string
  is_active: boolean
  created_at: string
  updated_at: string
}


// ── Sadakat Puan Sistemi ──

export type PointTransactionType = 'earn' | 'spend' | 'expire' | 'adjust'
export type PointTransactionSource = 'appointment' | 'visit_bonus' | 'campaign' | 'manual' | 'redemption'

export interface LoyaltyPoints {
  id: string
  business_id: string
  customer_id: string
  points_balance: number
  total_earned: number
  total_spent: number
  created_at: string
  updated_at: string
}

export interface PointTransaction {
  id: string
  business_id: string
  customer_id: string
  type: PointTransactionType
  points: number
  source: PointTransactionSource
  reference_id: string | null
  description: string | null
  created_at: string
}

export interface BlockedSlot {
  id: string
  business_id: string
  staff_id: string | null
  room_id: string | null
  date: string
  start_time: string
  end_time: string
  reason: string | null
  created_by: string | null
  created_at: string
}

// ── AI Assistant Tipleri ──

export type AIMessageRole = 'user' | 'assistant' | 'tool'

export interface AIConversation {
  id: string
  business_id: string
  staff_id: string
  title: string | null
  is_onboarding: boolean
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface AIMessage {
  id: string
  conversation_id: string
  role: AIMessageRole
  content: string | null
  tool_calls: any | null
  tool_name: string | null
  tool_call_id: string | null
  tool_result: any | null
  tokens_used: number
  created_at: string
}

export interface AIUsage {
  id: string
  business_id: string
  staff_id: string
  month: string
  message_count: number
  total_input_tokens: number
  total_output_tokens: number
  created_at: string
  updated_at: string
}

export interface AIStreamEvent {
  type: 'text' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'limit' | 'confirmation_required' | 'block'
  content?: string
  name?: string
  label?: string
  summary?: string
  conversationId?: string
  messageId?: string
  error?: string
  action_id?: string
  action_type?: string
  preview?: string
  details?: Record<string, unknown>
  block?: AIBlock
}

// ── AI Zengin UI Blokları (Faz 9) ──
export type AIBlockCellVariant = 'money' | 'percent' | 'delta' | 'muted' | 'strong'

export interface AIBlockTableColumn {
  key: string
  label: string
  align?: 'left' | 'right' | 'center'
  variant?: AIBlockCellVariant
}

export type AIBlockTableCell = string | number | null | {
  value: string | number | null
  variant?: AIBlockCellVariant
  hint?: string
}

export interface AIBlockTable {
  type: 'table'
  title?: string
  columns: AIBlockTableColumn[]
  rows: AIBlockTableCell[][]
  footer?: string
}

export interface AIBlockStatCard {
  label: string
  value: string
  delta?: number | null
  hint?: string
  tone?: 'default' | 'positive' | 'negative' | 'warning'
}

export interface AIBlockStatCards {
  type: 'stat_cards'
  title?: string
  cards: AIBlockStatCard[]
}

export interface AIBlockChart {
  type: 'chart'
  chartType: 'line' | 'bar' | 'pie'
  title?: string
  labels: string[]
  series: { name: string; data: number[] }[]
}

export type AIBlock = AIBlockTable | AIBlockStatCards | AIBlockChart
