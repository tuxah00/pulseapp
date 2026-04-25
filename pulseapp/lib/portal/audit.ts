/**
 * Portal-side audit logging.
 *
 * Müşteri portalı eylemlerini `audit_logs` tablosuna `actor_type='customer'` ile yazar.
 * Migration 070_audit_actor_type.sql ile actor_type + actor_id kolonları eklendi.
 *
 * Tipik eylemler: data_deletion_request, data_export_download, profile_update,
 * appointment_create, appointment_cancel, appointment_reschedule, payment_initiated,
 * feedback_submitted, review_submitted, consent_change.
 */
import type { NextRequest } from 'next/server'

export type PortalAuditAction =
  | 'data_deletion_request'
  | 'data_deletion_cancel'
  | 'data_export_download'
  | 'profile_update'
  | 'appointment_create'
  | 'appointment_cancel'
  | 'appointment_reschedule'
  | 'payment_initiated'
  | 'feedback_submitted'
  | 'review_submitted'
  | 'consent_change'

export interface PortalAuditParams {
  customerId: string
  businessId: string
  action: PortalAuditAction
  resource: string
  resourceId?: string | null
  details?: Record<string, unknown> | null
  ipAddress?: string | null
}

/**
 * `x-forwarded-for` header'ından client IP çekilir.
 * Vercel Edge'de virgülle ayrılmış chain gelir, ilk eleman = orijinal client.
 */
export function getClientIp(request: NextRequest): string | null {
  const fwd = request.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  return real || null
}

/**
 * Müşteri tarafından yapılan eylemleri audit_logs'a yazar.
 * Hata olursa sessizce yutar (audit kaydı kritik değil).
 */
export async function logPortalAction(params: PortalAuditParams): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      business_id: params.businessId,
      staff_id: null,
      staff_name: null,
      actor_type: 'customer',
      actor_id: params.customerId,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId || null,
      details: params.details ? JSON.parse(JSON.stringify(params.details)) : null,
      ip_address: params.ipAddress || null,
    })
  } catch {
    /* sessiz */
  }
}

/**
 * Sistem (cron, scheduler) tarafından yapılan eylemleri loglar.
 * actor_type='system'.
 */
export async function logSystemAction(params: {
  businessId: string
  action: string
  resource: string
  resourceId?: string | null
  details?: Record<string, unknown> | null
}): Promise<void> {
  try {
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      business_id: params.businessId,
      staff_id: null,
      staff_name: null,
      actor_type: 'system',
      actor_id: null,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId || null,
      details: params.details ? JSON.parse(JSON.stringify(params.details)) : null,
      ip_address: null,
    })
  } catch {
    /* sessiz */
  }
}
