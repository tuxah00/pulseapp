export async function logAudit(params: {
  businessId: string
  staffId: string | null
  staffName: string | null
  action: 'create' | 'update' | 'delete' | 'status_change'
  resource: string
  resourceId?: string
  details?: Record<string, string | number | boolean | null>
}) {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })
  } catch { /* audit hatası kritik değil */ }
}
