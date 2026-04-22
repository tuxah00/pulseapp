import type { SectorType } from '@/types'
import type { SkillId } from './types'

/**
 * Her skill paketinin içerdiği araç (tool) adları.
 * Yeni araç eklenince buradaki ilgili paketin listesine eklenmeli.
 */
export const SKILL_TOOL_NAMES: Record<SkillId, readonly string[]> = {
  /** Tüm sektörler için ortak araçlar */
  common: [
    // Randevular — okuma
    'list_appointments',
    'get_available_slots',
    // Randevular — yazma
    'create_appointment',
    'cancel_appointment',
    'update_appointment_status',
    'reschedule_appointment',
    // Müşteriler — okuma
    'search_customers',
    'get_customer_details',
    // Müşteriler — yazma
    'create_customer',
    'update_customer',
    'delete_customer',
    // Hizmetler
    'list_services',
    'list_packages',
    'create_service',
    'update_service',
    // Personel
    'list_staff',
    'get_staff_schedule',
    // Temel istatistikler
    'get_appointment_stats',
    'get_revenue_stats',
    'get_customer_stats',
    // İşletme bilgisi
    'get_business_info',
    'get_working_hours',
    // Mesajlar
    'list_pending_messages',
    'get_recent_messages',
    'send_message',
    // Denetim
    'search_audit_logs',
    // Zamanlanmış eylemler
    'schedule_action',
    'list_scheduled_actions',
    'cancel_scheduled_action',
    // Kampanyalar
    'list_campaigns',
    'estimate_campaign_audience',
    'create_campaign',
    'send_campaign',
    // İş akışları
    'list_workflows',
    'create_workflow',
    'toggle_workflow',
    // Sistem yönetimi
    'update_working_hours',
    'list_blocked_slots',
    'create_blocked_slot',
    'delete_blocked_slot',
    'list_shifts',
    'assign_shift',
    'create_shift_definition',
    'invite_staff',
    'update_staff_permissions',
    'update_business_settings',
    // Finans
    'list_unpaid_invoices',
    'create_invoice',
    'record_invoice_payment',
    'generate_invoice_from_appointment',
    'create_pos_transaction',
    'record_expense',
    'record_manual_income',
    // Hafıza (Faz 2)
    'semantic_search_history',
    'remember_preference',
    'forget_preference',
  ],

  /** Gelişmiş analitik ve strateji araçları */
  analytics: [
    'get_revenue_breakdown',
    'get_customer_lifetime_value',
    'get_occupancy_stats',
    'get_staff_performance',
    'get_expense_breakdown',
    'get_profit_loss',
    'compare_periods',
    'detect_risk_customers',
    'detect_anomalies',
    'recommend_strategic_actions',
    'get_business_insights',
  ],

  /** Estetik klinik özel araçlar */
  'medical-aesthetic': [
    'list_protocols',
    'get_protocol_details',
    'list_customer_allergies',
    'check_contraindications',
  ],

  /** Diş kliniği özel araçlar */
  'dental-clinic': [
    'list_tooth_records',
    'update_tooth_record',
  ],

  /** Kuaför & güzellik araçları (gelecek faz) */
  'hair-beauty': [],
}

/** Tüm sektörler için yüklenen varsayılan skill paketleri */
const DEFAULT_SKILLS: SkillId[] = ['common', 'analytics']

/**
 * Sektöre göre hangi skill paketleri yükleneceği.
 * Tanımlanmayan sektörler DEFAULT_SKILLS alır (common + analytics).
 */
export const SECTOR_SKILLS: Partial<Record<SectorType, SkillId[]>> = {
  medical_aesthetic: ['common', 'analytics', 'medical-aesthetic'],
  dental_clinic: ['common', 'analytics', 'dental-clinic'],
  hair_salon: ['common', 'analytics', 'hair-beauty'],
  barber: ['common', 'analytics', 'hair-beauty'],
  spa_massage: ['common', 'analytics', 'hair-beauty'],
  // Diğer tüm sektörler DEFAULT_SKILLS alır
}

/**
 * Bir sektör için yüklenecek skill paket ID'lerini döner.
 */
export function getSkillsForSector(sector: string): SkillId[] {
  return SECTOR_SKILLS[sector as SectorType] ?? DEFAULT_SKILLS
}

/**
 * Bir sektör için izin verilen tüm araç adlarını döner.
 */
export function getAllowedToolNamesForSector(sector: string): Set<string> {
  const skills = getSkillsForSector(sector)
  const names = skills.flatMap(s => SKILL_TOOL_NAMES[s] as string[])
  return new Set(names)
}
