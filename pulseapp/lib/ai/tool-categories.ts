import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import type { AIPermissionCategory, AIPermissions, StaffPermissions } from '@/types'
import { AI_PERMISSION_TO_STAFF, DEFAULT_AI_PERMISSIONS } from '@/types'

/**
 * AI Asistan tool adı → yetki kategorisi eşlemesi.
 * - Yetki kontrolü: bir tool çalışırken hem `business.settings.ai_permissions[category]` hem
 *   onay veren kullanıcının ilgili `StaffPermissions` alanı TRUE olmalı.
 * - Yeni bir tool eklendiğinde burada kategorisi tanımlanmalıdır; yoksa yetki kontrolü
 *   emniyet gereği false döner (tool çalışmaz).
 */
export const TOOL_CATEGORY: Record<string, AIPermissionCategory> = {
  // ── Okuma araçları ──
  list_appointments: 'appointments_read',
  get_available_slots: 'appointments_read',
  get_appointment_stats: 'appointments_read',
  list_blocked_slots: 'appointments_read',

  search_customers: 'customers_read',
  get_customer_details: 'customers_read',
  get_customer_stats: 'customers_read',
  get_customer_lifetime_value: 'customers_read',
  detect_risk_customers: 'customers_read',

  list_services: 'services_read',
  list_packages: 'services_read',

  list_staff: 'staff_read',
  get_staff_performance: 'staff_read',

  get_staff_schedule: 'shifts_read',
  list_shifts: 'shifts_read',

  list_pending_messages: 'messages_read',
  get_recent_messages: 'messages_read',

  list_campaigns: 'campaigns_read',
  estimate_campaign_audience: 'campaigns_read',

  list_workflows: 'workflows_read',

  get_revenue_stats: 'analytics_read',
  get_revenue_breakdown: 'analytics_read',
  get_occupancy_stats: 'analytics_read',
  get_expense_breakdown: 'analytics_read',
  get_profit_loss: 'analytics_read',
  compare_periods: 'analytics_read',
  detect_anomalies: 'analytics_read',

  list_unpaid_invoices: 'invoices_read',

  get_business_info: 'settings_read',
  get_working_hours: 'settings_read',

  search_audit_logs: 'audit_read',

  list_scheduled_actions: 'settings_read',

  // ── Yazma araçları ──
  create_appointment: 'appointments_write',
  cancel_appointment: 'appointments_write',
  update_appointment_status: 'appointments_write',
  reschedule_appointment: 'appointments_write',
  create_blocked_slot: 'appointments_write',
  delete_blocked_slot: 'appointments_write',

  create_customer: 'customers_write',
  update_customer: 'customers_write',
  delete_customer: 'customers_write',

  create_service: 'services_write',
  update_service: 'services_write',

  invite_staff: 'staff_write',
  update_staff_permissions: 'staff_write',

  assign_shift: 'shifts_write',
  create_shift_definition: 'shifts_write',

  send_message: 'messages_write',

  create_campaign: 'campaigns_write',
  send_campaign: 'campaigns_write',

  create_workflow: 'workflows_write',
  toggle_workflow: 'workflows_write',

  create_invoice: 'invoices_write',
  record_invoice_payment: 'invoices_write',
  generate_invoice_from_appointment: 'invoices_write',

  create_pos_transaction: 'pos_write',

  record_expense: 'expenses_write',
  record_manual_income: 'expenses_write',

  update_working_hours: 'settings_write',
  update_business_settings: 'settings_write',

  // Scheduling meta-işlemleri — appointments altında tutulur
  schedule_action: 'appointments_write',
  cancel_scheduled_action: 'appointments_write',
}

export function getToolCategory(toolName: string): AIPermissionCategory | null {
  return TOOL_CATEGORY[toolName] ?? null
}

/**
 * Bir AI tool'unun çalışmasına izin verilip verilmediğini döner.
 * Kesişim kuralı: business ai_permissions[category] AND user effectivePerms[mappedKey].
 * Kategori tanımsızsa güvenlik gereği false.
 */
export function isToolAllowed(
  toolName: string,
  aiPermissions: AIPermissions | null | undefined,
  effectivePerms: StaffPermissions,
): boolean {
  const category = getToolCategory(toolName)
  if (!category) return false
  const ai = { ...DEFAULT_AI_PERMISSIONS, ...(aiPermissions ?? {}) }
  if (ai[category] !== true) return false
  const staffKey = AI_PERMISSION_TO_STAFF[category]
  return effectivePerms[staffKey] === true
}

/**
 * ASSISTANT_TOOLS listesini kesişim kuralına göre filtreler —
 * modele yalnızca hem AI hem kullanıcı izni olan tool'lar sunulur.
 */
export function filterAssistantTools(
  tools: ChatCompletionTool[],
  aiPermissions: AIPermissions | null | undefined,
  effectivePerms: StaffPermissions,
): ChatCompletionTool[] {
  return tools.filter((t) =>
    t.type === 'function' && isToolAllowed(t.function.name, aiPermissions, effectivePerms),
  )
}
