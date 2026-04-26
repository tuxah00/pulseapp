/** Client-side audit log — dashboard sayfalarından çağrılır */
export async function logAudit(params: {
  businessId: string
  staffId: string | null
  staffName: string | null
  action: 'create' | 'update' | 'delete' | 'restore' | 'status_change' | 'send' | 'pay' | 'cancel' | 'assign' | 'revoke' | 'request'
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
}) {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch { /* audit hatası kritik değil */ }
}

/** Server-side audit log — API route'lardan doğrudan DB'ye yazar (fetch gerektirmez) */
export async function logAuditServer(params: {
  businessId: string
  staffId: string | null
  staffName: string | null
  action: string
  resource: string
  resourceId?: string
  details?: Record<string, unknown>
  ipAddress?: string | null
}) {
  try {
    // RLS bypass: audit_logs INSERT için user policy yok (sadece service role); audit kaydı her çağrıdan güvenle yazılmalı
    const { createAdminClient } = await import('@/lib/supabase/admin')
    const admin = createAdminClient()
    await admin.from('audit_logs').insert({
      business_id: params.businessId,
      staff_id: params.staffId || null,
      staff_name: params.staffName || null,
      action: params.action,
      resource: params.resource,
      resource_id: params.resourceId || null,
      details: params.details || null,
      ip_address: params.ipAddress || null,
    })
  } catch { /* audit hatası kritik değil */ }
}
