/**
 * Supabase auto-generated `Database` tipinin pratik kısayolları.
 *
 * Yeni dosyalarda `any` yerine bunları kullan:
 *
 *   import type { AppointmentRow } from '@/types/db'
 *   const [appts, setAppts] = useState<AppointmentRow[]>([])
 *
 * Generic'i `lib/supabase/client.ts`'e dayatmadık çünkü tüm select-string'leri
 * eş zamanlı güncellemek gerekirdi. Bu opt-in yaklaşım dosya bazlı tip güvenliği
 * sağlar; kademeli `any` temizliği için kullanılır.
 */

import type { Database } from './database'

type Tables = Database['public']['Tables']
type Views = Database['public']['Views']
type Enums = Database['public']['Enums']

// === Row tipleri (SELECT sonuçları) ===
export type AppointmentRow = Tables['appointments']['Row']
export type AuditLogRow = Tables['audit_logs']['Row']
export type BusinessRecordRow = Tables['business_records']['Row']
export type BusinessRow = Tables['businesses']['Row']
export type ClassRow = Tables['classes']['Row']
export type ClassAttendanceRow = Tables['class_attendance']['Row']
export type ClassSessionRow = Tables['class_sessions']['Row']
export type CustomerAllergyRow = Tables['customer_allergies']['Row']
export type CustomerPackageRow = Tables['customer_packages']['Row']
export type CustomerPhotoRow = Tables['customer_photos']['Row']
export type CustomerRow = Tables['customers']['Row']
export type ExpenseRow = Tables['expenses']['Row']
export type FollowUpRow = Tables['follow_up_queue']['Row']
export type IncomeRow = Tables['income']['Row']
export type InvoicePaymentRow = Tables['invoice_payments']['Row']
export type InvoiceRow = Tables['invoices']['Row']
export type MembershipRow = Tables['memberships']['Row']
export type MessageRow = Tables['messages']['Row']
export type MessageTemplateRow = Tables['message_templates']['Row']
export type NotificationRow = Tables['notifications']['Row']
export type OrderRow = Tables['orders']['Row']
export type PackageUsageRow = Tables['package_usages']['Row']
export type PaymentRow = Tables['payments']['Row']
export type PortfolioItemRow = Tables['portfolio_items']['Row']
export type PosSessionRow = Tables['pos_sessions']['Row']
export type ReviewRow = Tables['reviews']['Row']
export type ServiceRow = Tables['services']['Row']
export type StaffMemberRow = Tables['staff_members']['Row']
export type WaitlistRow = Tables['waitlist']['Row']

// === View tipleri ===
export type BusinessStatsView = Views['business_stats']['Row']

// === Insert / Update tipleri (mutation payload'ları) ===
export type AppointmentInsert = Tables['appointments']['Insert']
export type AppointmentUpdate = Tables['appointments']['Update']
export type CustomerInsert = Tables['customers']['Insert']
export type CustomerUpdate = Tables['customers']['Update']
export type InvoiceInsert = Tables['invoices']['Insert']
export type InvoiceUpdate = Tables['invoices']['Update']
export type MessageInsert = Tables['messages']['Insert']
export type ExpenseInsert = Tables['expenses']['Insert']
export type IncomeInsert = Tables['income']['Insert']
export type NotificationInsert = Tables['notifications']['Insert']

// === Enum tipleri ===
export type AppointmentStatusEnum = Enums['appointment_status']
export type AppointmentSourceEnum = Enums['appointment_source']
