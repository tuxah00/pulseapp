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
  records?: boolean
  portfolio?: boolean
  inventory?: boolean
  orders?: boolean
}

export const DEFAULT_PERMISSIONS: Record<StaffRole, StaffPermissions> = {
  owner: {
    dashboard: true, appointments: true, customers: true, analytics: true,
    messages: true, reviews: true, services: true, staff: true, shifts: true,
    settings: true, reservations: true, classes: true, memberships: true,
    records: true, portfolio: true, inventory: true, orders: true,
  },
  manager: {
    dashboard: true, appointments: true, customers: true, analytics: true,
    messages: true, reviews: true, services: true, staff: false, shifts: true,
    settings: false, reservations: true, classes: true, memberships: true,
    records: true, portfolio: true, inventory: true, orders: true,
  },
  staff: {
    dashboard: true, appointments: true, customers: true, analytics: false,
    messages: false, reviews: false, services: false, staff: false, shifts: false,
    settings: false, reservations: false, classes: false, memberships: false,
    records: false, portfolio: false, inventory: false, orders: false,
  },
}

export function getEffectivePermissions(role: StaffRole, customPermissions?: StaffPermissions | null): StaffPermissions {
  if (role === 'owner') return DEFAULT_PERMISSIONS.owner
  if (customPermissions) return customPermissions
  return DEFAULT_PERMISSIONS[role]
}

export type AppointmentStatus =
  | 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'

export type AppointmentSource = 'web' | 'manual' | 'phone'

export type CustomerSegment = 'new' | 'regular' | 'vip' | 'risk' | 'lost'

export type MessageDirection = 'inbound' | 'outbound'
export type MessageChannel = 'sms' | 'web'
export type MessageType = 'text' | 'template' | 'ai_generated' | 'system'
export type AiClassification =
  | 'appointment' | 'question' | 'complaint' | 'cancellation' | 'greeting' | 'other'

export type ReviewStatus = 'pending' | 'responded' | 'escalated'
export type NotificationType = 'appointment' | 'review' | 'payment' | 'customer' | 'system'


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

export interface BusinessSettings {
  reminder_24h: boolean
  reminder_2h: boolean
  auto_review_request: boolean
  review_request_delay_minutes: number
  winback_days: number
  ai_auto_reply: boolean
  language: string
  reservation_duration_minutes: number
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
  last_visit_at: string | null
  preferences: Record<string, any>
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
  paytr_response: Record<string, any> | null
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
  created_at: string
  // JOIN
  customer?: Customer
  service?: Service
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
